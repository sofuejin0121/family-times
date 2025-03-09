import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const toast = ({ title, description, type = 'default' }: { 
  title: string; 
  description: string; 
  type?: 'default' | 'success' | 'error' | 'warning' 
}) => {
  // トースト通知の実装
  console.log(`[${type}] ${title}: ${description}`)
}
