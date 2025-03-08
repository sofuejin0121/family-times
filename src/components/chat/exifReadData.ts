/**
 * EXIF データの型定義
 */
// Exif データに含まれる値の型
type ExifValue =
  | string
  | number
  | boolean
  | Uint8Array
  | Array<string | number>
  | null

// ExifSection インターフェース
interface ExifSection {
  [key: string]: ExifValue | ThumbnailData | undefined
  Thumbnail?: ThumbnailData
}

// ExifData インターフェース
interface ExifData {
  [section: string]: ExifSection | undefined
  COMPUTED?: ExifSection
  FILE?: ExifSection
  IFD0?: ExifSection
  EXIF?: ExifSection
  GPS?: ExifSection
  THUMBNAIL?: ExifSection
  COMMENT?: ExifSection
  WINXP?: ExifSection
}

// Thumbnailインターフェースを追加
interface ThumbnailData {
  Data: Uint8Array
  FileType?: number
  MimeType?: string
  Height?: number
  Width?: number
}

/**
 * 画像ファイルから EXIF ヘッダを読み込む
 *
 * @param file - 画像ファイル (File オブジェクト) または URL 文字列
 * @param requiredSections - 結果に含めるセクションのカンマ区切りリスト
 * @param asArrays - 各セクションを配列として返すかどうか
 * @param readThumbnail - サムネイル本体を読み込むかどうか
 * @returns - Promise オブジェクト。成功時は ExifData、失敗時はエラーを返す
 */
function exifReadData(
  file: File | string,
  requiredSections: string | null = null,
  asArrays: boolean = false,
  readThumbnail: boolean = false
): Promise<ExifData | false> {
  return new Promise((resolve, reject) => {
    // ファイルまたは URL を ArrayBuffer に変換
    const getArrayBuffer = (): Promise<ArrayBuffer> => {
      if (typeof file === 'string') {
        // URL の場合は fetch で読み込む
        return fetch(file).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch image from URL')
          }
          return response.arrayBuffer()
        })
      } else {
        // File オブジェクトの場合は FileReader で読み込む
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
              resolve(e.target.result)
            } else {
              reject(new Error('Failed to read file'))
            }
          }
          reader.onerror = () => reject(new Error('File reading error'))
          reader.readAsArrayBuffer(file)
        })
      }
    }

    getArrayBuffer()
      .then((arrayBuffer) => {
        // EXIF データの解析
        const exifData = parseExifData(arrayBuffer, readThumbnail)

        if (!exifData) {
          resolve(false)
          return
        }

        // FILE セクション情報を追加
        exifData.FILE = {
          FileName:
            typeof file === 'string'
              ? file.split('/').pop() || file
              : file.name,
          FileDateTime: Math.floor(Date.now() / 1000),
          FileSize: arrayBuffer.byteLength,
          FileType: getFileTypeFromArray(new Uint8Array(arrayBuffer, 0, 12)),
          SectionsFound: Object.keys(exifData).join(', '),
        }

        // COMPUTED セクション情報をマージ
        if (!exifData.COMPUTED) {
          exifData.COMPUTED = {}
        }

        // 画像のサイズ情報を追加（この処理は非同期で行う）
        getImageDimensions(arrayBuffer)
          .then((dimensions) => {
            // COMPUTED セクションの再確認
            if (!exifData.COMPUTED) {
              exifData.COMPUTED = {}
            }

            exifData.COMPUTED.Width = dimensions.width
            exifData.COMPUTED.Height = dimensions.height
            exifData.COMPUTED.html = `width="${dimensions.width}" height="${dimensions.height}"`
            exifData.COMPUTED.IsColor = 1 // デフォルトでカラー画像と仮定

            // サムネイルがある場合はサムネイル情報も追加
            if (exifData.THUMBNAIL && exifData.THUMBNAIL.Thumbnail) {
              exifData.COMPUTED['Thumbnail.FileType'] = 2 // JPEG
              exifData.COMPUTED['Thumbnail.MimeType'] = 'image/jpeg'
            }

            // 必要なセクションをフィルタリング
            if (requiredSections) {
              const sections = requiredSections.split(',').map((s) => s.trim())
              const filteredResult: ExifData = {}

              for (const section of sections) {
                if (exifData[section]) {
                  filteredResult[section] = exifData[section]
                }
              }

              // 必要なセクションが見つからなかった場合は false を返す
              if (Object.keys(filteredResult).length === 0) {
                resolve(false)
                return
              }

              resolve(filteredResult)
            } else {
              // 各セクションを配列として返すかどうか
              if (asArrays) {
                // COMPUTED, THUMBNAIL, COMMENT は常に配列として返す
                // 他のセクションも配列として返す
                const result: ExifData = {}
                for (const section in exifData) {
                  if (exifData[section]) {
                    result[section] = { ...exifData[section] }
                  }
                }
                resolve(result)
              } else {
                resolve(exifData)
              }
            }
          })
          .catch((error) => {
            // 画像サイズの取得に失敗してもEXIFデータは返す
            console.warn('Failed to get image dimensions:', error)

            // 必要なセクションのフィルタリング
            if (requiredSections) {
              const sections = requiredSections.split(',').map((s) => s.trim())
              const filteredResult: ExifData = {}

              for (const section of sections) {
                if (exifData[section]) {
                  filteredResult[section] = exifData[section]
                }
              }

              if (Object.keys(filteredResult).length === 0) {
                resolve(false)
                return
              }

              resolve(filteredResult)
            } else {
              resolve(exifData)
            }
          })
      })
      .catch((error) => {
        reject(error)
      })
  })
}

/**
 * ArrayBuffer から EXIF データを解析する
 */
function parseExifData(
  arrayBuffer: ArrayBuffer,
  readThumbnail: boolean = false
): ExifData | false {
  const view = new DataView(arrayBuffer)

  // JPEG ファイルかチェック
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
    return false // JPEG ではない
  }

  let offset = 2
  const length = view.byteLength
  let marker

  // EXIF セグメントを探す
  while (offset < length) {
    marker = view.getUint8(offset)
    if (marker !== 0xff) {
      return false // 無効なマーカー
    }

    marker = view.getUint8(offset + 1)

    // APP1 マーカー (0xE1) は EXIF データを含む
    if (marker === 0xe1) {
      return readExifSegment(view, offset + 4, readThumbnail)
    } else if (marker === 0xda || marker === 0xd9) {
      // スキャンデータまたは EOI マーカーなら EXIF はない
      return false
    }

    // 次のセグメントへ
    offset += 2 + view.getUint16(offset + 2, false)
  }

  return false // EXIF セグメントが見つからない
}

/**
 * EXIF セグメントを読み込む
 */
function readExifSegment(
  view: DataView,
  start: number,
  readThumbnail: boolean
): ExifData | false {
  // "Exif\0\0" の文字列をチェック
  const exifHeader = getStringFromView(view, start, 6)
  if (exifHeader !== 'Exif\0\0') {
    return false
  }

  const tiffStart = start + 6

  // バイトオーダーの確認
  const byteOrder = view.getUint16(tiffStart, false)
  let bigEndian

  if (byteOrder === 0x4949) {
    // 'II'
    bigEndian = false
  } else if (byteOrder === 0x4d4d) {
    // 'MM'
    bigEndian = true
  } else {
    return false // 無効なバイトオーダー
  }

  // TIFF ヘッダの確認
  if (view.getUint16(tiffStart + 2, bigEndian) !== 0x002a) {
    return false
  }

  // IFD0 の開始位置
  const ifd0Offset = view.getUint32(tiffStart + 4, bigEndian)

  // 結果を格納するオブジェクト
  const result: ExifData = {
    IFD0: {},
    EXIF: {},
    GPS: {},
    COMPUTED: {},
    COMMENT: {},
    WINXP: {},
  }

  // IFD0 のエントリを読み込む
  result.IFD0 = readIFDTags(view, tiffStart + ifd0Offset, tiffStart, bigEndian)

  // ExifIFD へのリンクを探す
  if (result.IFD0 && result.IFD0[0x8769]) {
    const exifOffset = result.IFD0[0x8769] as number
    result.EXIF = readIFDTags(
      view,
      tiffStart + exifOffset,
      tiffStart,
      bigEndian
    )
    delete result.IFD0[0x8769] // リンクタグを削除
  }

  // GPSIFD へのリンクを探す
  if (result.IFD0 && result.IFD0[0x8825]) {
    const gpsOffset = result.IFD0[0x8825] as number
    result.GPS = readIFDTags(view, tiffStart + gpsOffset, tiffStart, bigEndian)
    delete result.IFD0[0x8825] // リンクタグを削除
  }

  // IFD1 (サムネイル) へのリンクを探す
  if (readThumbnail) {
    const ifd0EntryCount = view.getUint16(tiffStart + ifd0Offset, bigEndian)
    const ifd1Offset = view.getUint32(
      tiffStart + ifd0Offset + 2 + ifd0EntryCount * 12,
      bigEndian
    )

    if (ifd1Offset !== 0) {
      result.THUMBNAIL = readIFDTags(
        view,
        tiffStart + ifd1Offset,
        tiffStart,
        bigEndian
      )

      // サムネイルデータがある場合は読み込む
      if (result.THUMBNAIL[0x0201] && result.THUMBNAIL[0x0202]) {
        const jpegOffset = result.THUMBNAIL[0x0201] as number
        const jpegLength = result.THUMBNAIL[0x0202] as number

        result.THUMBNAIL.JPEGInterchangeFormat = jpegOffset
        result.THUMBNAIL.JPEGInterchangeFormatLength = jpegLength

        if (readThumbnail) {
          const thumbnailBuffer = new Uint8Array(
            view.buffer.slice(
              tiffStart + jpegOffset,
              tiffStart + jpegOffset + jpegLength
            )
          )
          result.THUMBNAIL.Thumbnail = {
            Data: thumbnailBuffer,
          }
        }
      }
    }
  }

  // コメントセクションの読み込み
  try {
    // JPEGファイルのコメントセクションを探す
    let commentOffset = 2 // JPEGヘッダの後から
    while (commentOffset < view.byteLength - 1) {
      if (view.getUint8(commentOffset) === 0xff) {
        const marker = view.getUint8(commentOffset + 1)
        if (marker === 0xfe) {
          // COMマーカー
          const commentLength = view.getUint16(commentOffset + 2, false) - 2
          const commentStart = commentOffset + 4
          if (commentStart + commentLength <= view.byteLength) {
            const commentText = getStringFromView(
              view,
              commentStart,
              commentLength
            )
            if (!result.COMMENT) result.COMMENT = {}
            const commentIndex = Object.keys(result.COMMENT).length
            result.COMMENT[commentIndex] = commentText
          }
        }
        // 次のマーカーへ
        if (marker === 0xd9) break // EOIマーカー
        if (marker >= 0xd0 && marker <= 0xd7) {
          commentOffset += 2 // RSTマーカーはサイズフィールドを持たない
        } else {
          const segmentLength = view.getUint16(commentOffset + 2, false)
          commentOffset += 2 + segmentLength
        }
      } else {
        commentOffset++
      }
    }
  } catch (e) {
    console.warn('Error reading JPEG comments:', e)
  }

  // Windows XP タグの読み込み
  try {
    if (result.IFD0) {
      const winXpTags = [0x9c9b, 0x9c9c, 0x9c9d, 0x9c9e, 0x9c9f] // XPTitle, XPComment, XPAuthor, XPKeywords, XPSubject
      let hasWinXpData = false

      for (const tag of winXpTags) {
        if (result.IFD0[tag]) {
          if (!result.WINXP) result.WINXP = {}
          const tagName = getTagName(tag) || tag.toString()
          const rawValue = result.IFD0[tag]

          // Windows XPタグはUTF-16LEでエンコードされている
          if (rawValue instanceof Uint8Array) {
            try {
              const decoder = new TextDecoder('utf-16le')
              const text = decoder.decode(rawValue).replace(/\0+$/, '') // 末尾のnull文字を削除
              result.WINXP[tagName] = text
              hasWinXpData = true
            } catch {
              result.WINXP[tagName] = rawValue
            }
          } else {
            result.WINXP[tagName] = rawValue
            hasWinXpData = true
          }
        }
      }

      if (!hasWinXpData) {
        delete result.WINXP
      }
    }
  } catch (e) {
    console.warn('Error reading Windows XP tags:', e)
  }

  // 追加の処理 (Copyright, UserComment など)
  parseSpecialTags(result)

  return result
}

/**
 * IFDタグを読み込む
 */
function readIFDTags(
  view: DataView,
  ifdOffset: number,
  tiffStart: number,
  bigEndian: boolean
): ExifSection {
  const result: ExifSection = {}
  const entryCount = view.getUint16(ifdOffset, bigEndian)

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + i * 12 + 2
    const tag = view.getUint16(entryOffset, bigEndian)
    const type = view.getUint16(entryOffset + 2, bigEndian)
    const count = view.getUint32(entryOffset + 4, bigEndian)
    const valueOffset = view.getUint32(entryOffset + 8, bigEndian)

    // データのサイズを計算
    let valueSize = count
    if (type === 1 || type === 2) {
      // BYTE または ASCII
      valueSize = count
    } else if (type === 3) {
      // SHORT
      valueSize = count * 2
    } else if (type === 4) {
      // LONG
      valueSize = count * 4
    } else if (type === 5) {
      // RATIONAL
      valueSize = count * 8
    } else if (type === 7) {
      // UNDEFINED
      valueSize = count
    } else if (type === 9) {
      // SLONG
      valueSize = count * 4
    } else if (type === 10) {
      // SRATIONAL
      valueSize = count * 8
    }

    let value

    // 値のオフセットとタイプに基づいて値を読み取る
    if (valueSize <= 4) {
      // 値が直接エントリに埋め込まれている場合
      value = readTagValue(view, entryOffset + 8, type, count, bigEndian)
    } else {
      // 値が別の場所にある場合
      value = readTagValue(
        view,
        tiffStart + valueOffset,
        type,
        count,
        bigEndian
      )
    }

    // タグ名を取得（既知のタグ名がある場合）
    const tagName = getTagName(tag)

    // 結果に追加
    if (tagName) {
      result[tagName] = value
    }
    result[tag] = value // 数値タグも保存
  }

  return result
}

/**
 * タグの値を読み込む
 */
function readTagValue(
  view: DataView,
  offset: number,
  type: number,
  count: number,
  bigEndian: boolean
): ExifValue {
  if (type === 1) {
    // BYTE
    if (count === 1) {
      return view.getUint8(offset)
    } else {
      const values = new Uint8Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = view.getUint8(offset + i)
      }
      return values
    }
  } else if (type === 2) {
    // ASCII
    return getStringFromView(view, offset, count)
  } else if (type === 3) {
    // SHORT
    if (count === 1) {
      return view.getUint16(offset, bigEndian)
    } else {
      const values = new Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = view.getUint16(offset + i * 2, bigEndian)
      }
      return values
    }
  } else if (type === 4) {
    // LONG
    if (count === 1) {
      return view.getUint32(offset, bigEndian)
    } else {
      const values = new Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = view.getUint32(offset + i * 4, bigEndian)
      }
      return values
    }
  } else if (type === 5) {
    // RATIONAL
    if (count === 1) {
      const numerator = view.getUint32(offset, bigEndian)
      const denominator = view.getUint32(offset + 4, bigEndian)
      return numerator + '/' + denominator
    } else {
      const values = new Array(count)
      for (let i = 0; i < count; i++) {
        const numerator = view.getUint32(offset + i * 8, bigEndian)
        const denominator = view.getUint32(offset + i * 8 + 4, bigEndian)
        values[i] = numerator + '/' + denominator
      }
      return values
    }
  } else if (type === 7) {
    // UNDEFINED
    if (count === 1) {
      return view.getUint8(offset)
    } else {
      const values = new Uint8Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = view.getUint8(offset + i)
      }
      return values
    }
  } else if (type === 9) {
    // SLONG
    if (count === 1) {
      return view.getInt32(offset, bigEndian)
    } else {
      const values = new Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = view.getInt32(offset + i * 4, bigEndian)
      }
      return values
    }
  } else if (type === 10) {
    // SRATIONAL
    if (count === 1) {
      const numerator = view.getInt32(offset, bigEndian)
      const denominator = view.getInt32(offset + 4, bigEndian)
      return numerator + '/' + denominator
    } else {
      const values = new Array(count)
      for (let i = 0; i < count; i++) {
        const numerator = view.getInt32(offset + i * 8, bigEndian)
        const denominator = view.getInt32(offset + i * 8 + 4, bigEndian)
        values[i] = numerator + '/' + denominator
      }
      return values
    }
  }

  return null
}

/**
 * DataView から文字列を取得
 */
function getStringFromView(
  view: DataView,
  offset: number,
  length: number
): string {
  let str = ''
  for (let i = 0; i < length; i++) {
    const charCode = view.getUint8(offset + i)
    if (charCode === 0) {
      break // NULL文字で終了
    }
    str += String.fromCharCode(charCode)
  }
  return str
}

/**
 * 特殊なタグを解析する (Copyright, UserComment など)
 */
function parseSpecialTags(exifData: ExifData): void {
  // Copyright の処理
  if (exifData.IFD0 && exifData.IFD0.Copyright) {
    const copyright = exifData.IFD0.Copyright
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    exifData.COMPUTED.Copyright = copyright

    // NULL文字で区切られている場合は、写真家と編集者の情報を分解
    if (typeof copyright === 'string' && copyright.includes('\0')) {
      const parts = copyright.split('\0')
      exifData.COMPUTED['Copyright.Photographer'] = parts[0]
      exifData.COMPUTED['Copyright.Editor'] = parts[1]
    }
  }

  // UserComment の処理
  if (exifData.EXIF && exifData.EXIF.UserComment) {
    const userComment = exifData.EXIF.UserComment
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    // UserCommentの処理 (最初の8バイトはエンコーディング情報)
    if (userComment instanceof Uint8Array && userComment.length > 8) {
      // エンコーディング情報の取得
      const encoding = new TextDecoder().decode(userComment.slice(0, 8)).trim()
      exifData.COMPUTED.UserCommentEncoding = encoding || 'UNDEFINED'

      // コメント本体の取得
      const commentBody = userComment.slice(8)
      try {
        exifData.COMPUTED.UserComment = new TextDecoder()
          .decode(commentBody)
          .trim()
      } catch {
        exifData.COMPUTED.UserComment = ''
      }
    } else if (typeof userComment === 'string') {
      exifData.COMPUTED.UserComment = userComment
      exifData.COMPUTED.UserCommentEncoding = 'ASCII'
    }
  }

  // 露出時間の処理
  if (exifData.EXIF && exifData.EXIF.ExposureTime) {
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    const exposureTime = exifData.EXIF.ExposureTime
    if (typeof exposureTime === 'string' && exposureTime.includes('/')) {
      const [numerator, denominator] = exposureTime.split('/').map(Number)
      if (numerator && denominator) {
        if (numerator >= denominator) {
          exifData.COMPUTED.ExposureTime = `${Math.round(numerator / denominator)}s`
        } else {
          exifData.COMPUTED.ExposureTime = `1/${Math.round(denominator / numerator)}s`
        }
      }
    }
  }

  // F値の処理
  if (exifData.EXIF && exifData.EXIF.FNumber) {
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    const fNumber = exifData.EXIF.FNumber
    if (typeof fNumber === 'string' && fNumber.includes('/')) {
      const [numerator, denominator] = fNumber.split('/').map(Number)
      if (numerator && denominator) {
        exifData.COMPUTED.ApertureFNumber = `f/${(numerator / denominator).toFixed(1)}`
      }
    }
  }

  // ApertureValue からの F値の計算
  if (!exifData.COMPUTED?.ApertureFNumber && exifData.EXIF?.ApertureValue) {
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    const apertureValue = exifData.EXIF.ApertureValue
    if (typeof apertureValue === 'string' && apertureValue.includes('/')) {
      const [numerator, denominator] = apertureValue.split('/').map(Number)
      if (numerator && denominator) {
        const apex = numerator / denominator
        const fstop = Math.pow(2, apex / 2)
        exifData.COMPUTED.ApertureFNumber = `f/${fstop.toFixed(1)}`
      }
    }
  }

  // ShutterSpeedValue からの露出時間の計算
  if (!exifData.COMPUTED?.ExposureTime && exifData.EXIF?.ShutterSpeedValue) {
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }

    const shutterSpeedValue = exifData.EXIF.ShutterSpeedValue
    if (
      typeof shutterSpeedValue === 'string' &&
      shutterSpeedValue.includes('/')
    ) {
      const [numerator, denominator] = shutterSpeedValue.split('/').map(Number)
      if (numerator && denominator) {
        const apex = numerator / denominator
        const shutter = Math.pow(2, -apex)
        if (shutter >= 1) {
          exifData.COMPUTED.ExposureTime = `${Math.round(shutter)}s`
        } else {
          exifData.COMPUTED.ExposureTime = `1/${Math.round(1 / shutter)}s`
        }
      }
    }
  }

  // 画像の向きの処理
  if (exifData.IFD0 && exifData.IFD0.Orientation) {
    if (!exifData.COMPUTED) {
      exifData.COMPUTED = {}
    }
    exifData.COMPUTED.Orientation = exifData.IFD0.Orientation
  }
}

/**
 * ファイルタイプを取得する
 */
function getFileTypeFromArray(arr: Uint8Array): number {
  // JPEG のシグネチャをチェック
  if (arr[0] === 0xff && arr[1] === 0xd8) {
    return 2 // JPEG
  }

  // GIF のシグネチャをチェック
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
    return 1 // GIF
  }

  // PNG のシグネチャをチェック
  if (
    arr[0] === 0x89 &&
    arr[1] === 0x50 &&
    arr[2] === 0x4e &&
    arr[3] === 0x47 &&
    arr[4] === 0x0d &&
    arr[5] === 0x0a &&
    arr[6] === 0x1a &&
    arr[7] === 0x0a
  ) {
    return 3 // PNG
  }

  // TIFF のシグネチャをチェック
  if (
    (arr[0] === 0x49 &&
      arr[1] === 0x49 &&
      arr[2] === 0x2a &&
      arr[3] === 0x00) ||
    (arr[0] === 0x4d && arr[1] === 0x4d && arr[2] === 0x00 && arr[3] === 0x2a)
  ) {
    return 4 // TIFF
  }

  return 0 // 不明なタイプ
}

/**
 * 画像のサイズを取得する
 */
function getImageDimensions(
  arrayBuffer: ArrayBuffer
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // 画像のBlobを作成
    const blob = new Blob([arrayBuffer])
    const url = URL.createObjectURL(blob)

    // 画像を読み込んでサイズを取得
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      reject(new Error('Failed to load image for size calculation'))
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/**
 * タグIDからタグ名を取得する
 */
function getTagName(tagId: number): string | null {
  // 一般的なタグIDとタグ名のマッピング
  const tagNames: { [key: number]: string } = {
    // IFD0 タグ
    0x010e: 'ImageDescription',
    0x010f: 'Make',
    0x0110: 'Model',
    0x0112: 'Orientation',
    0x011a: 'XResolution',
    0x011b: 'YResolution',
    0x0128: 'ResolutionUnit',
    0x0131: 'Software',
    0x0132: 'DateTime',
    0x013b: 'Artist',
    0x013c: 'HostComputer',
    0x013e: 'WhitePoint',
    0x013f: 'PrimaryChromaticities',
    0x0211: 'YCbCrCoefficients',
    0x0213: 'YCbCrPositioning',
    0x0214: 'ReferenceBlackWhite',
    0x8298: 'Copyright',
    0x8769: 'ExifIFDPointer',
    0x8825: 'GPSInfoIFDPointer',

    // EXIF タグ
    0x829a: 'ExposureTime',
    0x829d: 'FNumber',
    0x8822: 'ExposureProgram',
    0x8824: 'SpectralSensitivity',
    0x8827: 'ISOSpeedRatings',
    0x8828: 'OECF',
    0x9000: 'ExifVersion',
    0x9003: 'DateTimeOriginal',
    0x9004: 'DateTimeDigitized',
    0x9101: 'ComponentsConfiguration',
    0x9102: 'CompressedBitsPerPixel',
    0x9201: 'ShutterSpeedValue',
    0x9202: 'ApertureValue',
    0x9203: 'BrightnessValue',
    0x9204: 'ExposureBiasValue',
    0x9205: 'MaxApertureValue',
    0x9206: 'SubjectDistance',
    0x9207: 'MeteringMode',
    0x9208: 'LightSource',
    0x9209: 'Flash',
    0x920a: 'FocalLength',
    0x927c: 'MakerNote',
    0x9286: 'UserComment',
    0x9290: 'SubsecTime',
    0x9291: 'SubsecTimeOriginal',
    0x9292: 'SubsecTimeDigitized',
    0xa000: 'FlashpixVersion',
    0xa001: 'ColorSpace',
    0xa002: 'PixelXDimension',
    0xa003: 'PixelYDimension',
    0xa004: 'RelatedSoundFile',
    0xa005: 'InteroperabilityIFDPointer',
    0xa20b: 'FlashEnergy',
    0xa20c: 'SpatialFrequencyResponse',
    0xa20e: 'FocalPlaneXResolution',
    0xa20f: 'FocalPlaneYResolution',
    0xa210: 'FocalPlaneResolutionUnit',
    0xa214: 'SubjectLocation',
    0xa215: 'ExposureIndex',
    0xa217: 'SensingMethod',
    0xa300: 'FileSource',
    0xa301: 'SceneType',
    0xa302: 'CFAPattern',
    0xa401: 'CustomRendered',
    0xa402: 'ExposureMode',
    0xa403: 'WhiteBalance',
    0xa404: 'DigitalZoomRatio',
    0xa405: 'FocalLengthIn35mmFilm',
    0xa406: 'SceneCaptureType',
    0xa407: 'GainControl',
    0xa408: 'Contrast',
    0xa409: 'Saturation',
    0xa40a: 'Sharpness',
    0xa40b: 'DeviceSettingDescription',
    0xa40c: 'SubjectDistanceRange',
    0xa420: 'ImageUniqueID',

    // GPS タグ
    0x0000: 'GPSVersionID',
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x0008: 'GPSSatellites',
    0x0009: 'GPSStatus',
    0x000a: 'GPSMeasureMode',
    0x000b: 'GPSDOP',
    0x000c: 'GPSSpeedRef',
    0x000d: 'GPSSpeed',
    0x000e: 'GPSTrackRef',
    0x000f: 'GPSTrack',
    0x0010: 'GPSImgDirectionRef',
    0x0011: 'GPSImgDirection',
    0x0012: 'GPSMapDatum',
    0x0013: 'GPSDestLatitudeRef',
    0x0014: 'GPSDestLatitude',
    0x0015: 'GPSDestLongitudeRef',
    0x0016: 'GPSDestLongitude',
    0x0017: 'GPSDestBearingRef',
    0x0018: 'GPSDestBearing',
    0x0019: 'GPSDestDistanceRef',
    0x001a: 'GPSDestDistance',
    0x001b: 'GPSProcessingMethod',
    0x001c: 'GPSAreaInformation',
    0x001d: 'GPSDateStamp',
    0x001e: 'GPSDifferential',

    // サムネイルタグ
    0x0100: 'ImageWidth',
    0x0101: 'ImageLength',
    0x0102: 'BitsPerSample',
    0x0103: 'Compression',
    0x0106: 'PhotometricInterpretation',
    0x0111: 'StripOffsets',
    0x0115: 'SamplesPerPixel',
    0x0116: 'RowsPerStrip',
    0x0117: 'StripByteCounts',
    0x0201: 'JPEGInterchangeFormat',
    0x0202: 'JPEGInterchangeFormatLength',
    0x0212: 'YCbCrSubSampling',
  }

  return tagNames[tagId] || null
}

// 公開用の関数をエクスポート
export default exifReadData
