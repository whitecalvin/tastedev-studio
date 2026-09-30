// Runtime handles only. File content never enters IndexedDB.
export class HandleStore {
  private async database() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tastedev-studio-handles', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('folders');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async get(id: string): Promise<FileSystemDirectoryHandle | undefined> {
    const db = await this.database();
    try { return await new Promise((resolve, reject) => { const request = db.transaction('folders').objectStore('folders').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  }
  async put(id: string, handle: FileSystemDirectoryHandle | null) {
    const db = await this.database();
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('folders', 'readwrite'); if (handle) tx.objectStore('folders').put(handle, id); else tx.objectStore('folders').delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  }
}
