import PouchDB from 'pouchdb';
import { QsoEntry } from '../types/qso';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';

interface DatabaseResponse {
  ok: boolean;
  id?: string;
  error?: Error | unknown;
}

interface UpdateResponse extends DatabaseResponse {
  rev?: string;
}

// Get the HamLedger data directory path
// Uses ~/.hamledger in user's home folder
function getHamLedgerDataPath(): string {
  const homedir = app.getPath('home');
  const hamledgerDir = join(homedir, '.hamledger');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(hamledgerDir)) {
    fs.mkdirSync(hamledgerDir, { recursive: true });
  }
  
  return hamledgerDir;
}

export class DatabaseService {
  private db!: PouchDB.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = join(getHamLedgerDataPath(), 'HamLedger.db');
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
    this.db = new PouchDB(this.dbPath);
  }
  public async saveQso(qso: QsoEntry): Promise<DatabaseResponse> {
    try {
      const response = await this.db.post(qso);
      //await this.backupToJson();
      return { ok: true, id: response.id };
    } catch (error) {
      console.error('Failed to save QSO:', error);
      return { ok: false, error };
    }
  }

  public async updateQso(qso: QsoEntry): Promise<UpdateResponse> {
    try {
      // Get the latest version of the document to ensure we have the current _rev
      const currentDoc = await this.db.get(qso._id!);

      // Merge the updates with the current document, preserving the latest _rev
      const updatedQso = {
        ...qso,
        _rev: currentDoc._rev,
      };

      const response = await this.db.put(updatedQso);
      await this.backupToJson();
      return { ok: true, id: response.id, rev: response.rev };
    } catch (error) {
      console.error('Failed to update QSO:', error);
      return { ok: false, error };
    }
  }

  public async deleteQso(qsoId: string): Promise<DatabaseResponse> {
    try {
      // Get the current document to get the latest _rev
      const currentDoc = await this.db.get(qsoId);

      // Delete the document
      const response = await this.db.remove(currentDoc);
      await this.backupToJson();
      return { ok: true, id: response.id };
    } catch (error) {
      console.error('Failed to delete QSO:', error);
      return { ok: false, error };
    }
  }

  public async getAllQsos(): Promise<QsoEntry[]> {
    try {
      const allDocs = await this.db.allDocs({ include_docs: true });
      return allDocs.rows.map(row => {
        const qso = row.doc as QsoEntry;
        // Ensure _id and _rev are present from the row metadata
        qso._id = row.id;
        qso._rev = row.value.rev;
        return qso;
      });
    } catch (error) {
      console.error('Failed to get QSOs:', error);
      return [];
    }
  }

  private async backupToJson(): Promise<void> {
    try {
      const jsonPath = join(getHamLedgerDataPath(), 'HamLedger.json');
      const allDocs = await this.db.allDocs({ include_docs: true });
      const jsonData = allDocs.rows.map(row => row.doc);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    } catch (error) {
      console.error('Failed to backup database:', error);
    }
  }
}

export const databaseService = new DatabaseService();
