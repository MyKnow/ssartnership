"use client";

import {
  createImageUploadSubmissionKey,
  createImageUploadDraft,
  readImageUploadSubmissionKey,
  readImageUploadDraft,
  type ImageUploadDraft,
  type ImageUploadDraftManifest,
  type ImageUploadDraftValue,
} from "@/lib/image-upload/draft";

const SESSION_PREFIX = "ssartnership:image-upload-draft:";
const SUBMISSION_KEY_SUFFIX = ":submission-key";
const DATABASE_NAME = "ssartnership-image-upload-drafts";
const STORE_NAME = "draft-files";

export type ImageUploadDraftFile = {
  clientId: string;
  role: string;
  order: number;
  file: File;
  uploadId?: string;
};

type StoredDraftFile = {
  key: string;
  formKey: string;
  clientId: string;
  role: string;
  order: number;
  fileName: string;
  contentType: string;
  lastModified: number;
  uploadId?: string;
  blob: Blob;
};

function getSessionKey(formKey: string) {
  return `${SESSION_PREFIX}${formKey}`;
}

function getSubmissionSessionKey(formKey: string) {
  return `${getSessionKey(formKey)}${SUBMISSION_KEY_SUFFIX}`;
}

function getFileKey(formKey: string, clientId: string) {
  return `${formKey}:${clientId}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("임시 이미지 저장소를 열지 못했습니다."));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = callback(store);
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("임시 이미지 저장소 작업에 실패했습니다."));
      }
      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => reject(transaction.error ?? new Error("임시 이미지 저장소 작업에 실패했습니다."));
      transaction.onabort = () => reject(transaction.error ?? new Error("임시 이미지 저장소 작업이 취소되었습니다."));
    });
  } finally {
    database.close();
  }
}

export function loadImageUploadDraft(formKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionKey(formKey));
    return raw ? readImageUploadDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveImageUploadDraft(input: {
  formKey: string;
  values: Record<string, ImageUploadDraftValue>;
  manifests: ImageUploadDraftManifest[];
}) {
  if (typeof window === "undefined") return null;
  const draft = createImageUploadDraft(input);
  try {
    window.sessionStorage.setItem(getSessionKey(input.formKey), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

/**
 * Returns a 24-hour, form-scoped retry key. It deliberately lives outside the
 * editable draft payload so form serializers can continue excluding hidden
 * inputs and sensitive values.
 */
export function getOrCreateImageUploadSubmissionId(formKey: string) {
  if (
    typeof window === "undefined"
    || typeof window.crypto?.randomUUID !== "function"
  ) {
    return null;
  }
  try {
    const sessionKey = getSubmissionSessionKey(formKey);
    const existing = readImageUploadSubmissionKey(
      JSON.parse(window.sessionStorage.getItem(sessionKey) ?? "null"),
    );
    if (existing?.formKey === formKey) {
      return existing.id;
    }
    const next = createImageUploadSubmissionKey({
      formKey,
      id: window.crypto.randomUUID(),
    });
    window.sessionStorage.setItem(sessionKey, JSON.stringify(next));
    return next.id;
  } catch {
    return null;
  }
}

export function clearImageUploadDraft(formKey: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(getSessionKey(formKey));
    window.sessionStorage.removeItem(getSubmissionSessionKey(formKey));
  }
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return runTransaction("readwrite", (store) => {
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === "string" && key.startsWith(`${formKey}:`)) {
          store.delete(key);
        }
      }
    };
    return request;
  }).then(() => undefined).catch(() => undefined);
}

export async function saveImageUploadDraftFiles(
  formKey: string,
  files: ImageUploadDraftFile[],
) {
  if (typeof indexedDB === "undefined") return;
  const nextKeys = new Set(files.map((file) => getFileKey(formKey, file.clientId)));
  await runTransaction("readwrite", (store) => {
    for (const file of files) {
      const row: StoredDraftFile = {
        key: getFileKey(formKey, file.clientId),
        formKey,
        clientId: file.clientId,
        role: file.role,
        order: file.order,
        fileName: file.file.name,
        contentType: file.file.type,
        lastModified: file.file.lastModified,
        ...(file.uploadId ? { uploadId: file.uploadId } : {}),
        blob: file.file,
      };
      store.put(row);
    }
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (
          typeof key === "string"
          && key.startsWith(`${formKey}:`)
          && !nextKeys.has(key)
        ) {
          store.delete(key);
        }
      }
    };
    return request;
  }).catch(() => undefined);
}

export async function loadImageUploadDraftFiles(formKey: string) {
  if (typeof indexedDB === "undefined") return [] as ImageUploadDraftFile[];
  const rows = await runTransaction<StoredDraftFile[]>("readonly", (store) => store.getAll())
    .catch(() => [] as StoredDraftFile[]);
  return (rows ?? [])
    .filter((row) => row.formKey === formKey)
    .map((row) => ({
      clientId: row.clientId,
      role: row.role,
      order: Number.isInteger(row.order) ? row.order : 0,
      file: new File([row.blob], row.fileName, {
        type: row.contentType,
        lastModified: row.lastModified,
      }),
      ...(row.uploadId ? { uploadId: row.uploadId } : {}),
    }));
}

export function getImageUploadDraftManifest(
  draft: ImageUploadDraft | null,
  role: string,
) {
  return draft?.manifests
    .filter((manifest) => manifest.role === role)
    .sort((left, right) => left.order - right.order) ?? [];
}
