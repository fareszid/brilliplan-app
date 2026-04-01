const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/json'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25 MB

export function validateImageUpload(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return `Type de fichier non autorisé (${file.type}). Formats acceptés : JPG, PNG, GIF, WebP.`;
    }
    if (file.size > MAX_IMAGE_SIZE) {
        return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 5 Mo.`;
    }
    return null;
}

export function validateFileUpload(file: File): string | null {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return `Type de fichier non autorisé (${file.type}).`;
    }
    if (file.size > MAX_FILE_SIZE) {
        return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 25 Mo.`;
    }
    return null;
}
