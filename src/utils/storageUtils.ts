import {
    ref,
    uploadBytes,
    getDownloadURL,
    UploadMetadata,
} from 'firebase/storage'
import { storage } from '../firebase'

  /**
   * ArrayBufferをFirebase Cloud Storageにアップロードする
   * @param buffer アップロードするデータのArrayBuffer
   * @param path 保存先のパス
   * @param metadata ファイルのメタデータ
   * @returns アップロードされたファイルのダウンロードURL
   */
  export const uploadToFirebaseStorage = async (
    buffer: ArrayBuffer,
    path: string,
    metadata?: UploadMetadata,
  ): Promise<string> => {
    try {
      // 保存先のストレージ参照を作成
      const storageRef = ref(storage, path);
  
      // ArrayBufferからBlobを作成
      const blob = new Blob([buffer], {
        type: metadata?.contentType || 'image/avif',
      });
  
      // ファイルをアップロード
      const snapshot = await uploadBytes(storageRef, blob, metadata);
  
      // アップロードされたファイルのダウンロードURLを取得
      const downloadURL = await getDownloadURL(snapshot.ref);
  
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file to Firebase Storage:', error);
      throw error;
    }
  };
  
  /**
   * ユニークなファイル名を生成する
   * @param originalName 元のファイル名
   * @returns タイムスタンプを含むユニークなファイル名
   */
  export const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const extension = '.avif';
    const baseName = originalName.replace(/\.[^/.]+$/, ''); // 拡張子を削除
  
    // ファイル名に使用できない文字を削除
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  
    return `${sanitizedName}_${timestamp}${extension}`;
  };
  