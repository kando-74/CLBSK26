import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../utils/firebase'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024

function slugifyFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function buildAvatarPath(userId: string, fileName: string): string {
  const sanitizedUserId = userId.trim() || 'anonymous'
  const normalizedFileName = slugifyFileName(fileName || 'avatar') || 'avatar'
  const timestamp = Date.now()
  return `avatars/${sanitizedUserId}/${timestamp}-${normalizedFileName}`
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Formato no permitido. Usa JPG, PNG, WEBP o AVIF.'
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    return 'La imagen supera los 2 MB permitidos.'
  }

  return null
}

export async function uploadAvatarFile(userId: string, file: File): Promise<{ path: string; downloadUrl: string }> {
  const error = validateAvatarFile(file)
  if (error) {
    throw new Error(error)
  }

  const path = buildAvatarPath(userId, file.name)
  const avatarRef = ref(storage, path)

  const snapshot = await uploadBytes(avatarRef, file, {
    contentType: file.type,
    cacheControl: 'public, max-age=86400',
  })

  const downloadUrl = await getDownloadURL(snapshot.ref)
  return { path, downloadUrl }
}

export async function deleteAvatarFile(path: string | null | undefined): Promise<void> {
  if (!path) {
    return
  }

  const avatarRef = ref(storage, path)
  await deleteObject(avatarRef)
}
