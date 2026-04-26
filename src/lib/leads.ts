import { collection, addDoc, serverTimestamp, doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // Lead is usually not logged in
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function createLead(leadData: any) {
  const path = 'leads_manos_crm';
  
  // Webhooks based on type as requested
  const WEBHOOKS: Record<string, string> = {
    'Compra': 'https://n8n.drivvoo.com/webhook/c238d26a-ebce-4c00-ac3c-ba506042ab46',
    'Venda': 'https://n8n.drivvoo.com/webhook/684eb74d-9112-47c5-94af-a0982dbdcf35',
    'Financiamento': 'https://n8n.drivvoo.com/webhook/a5d2e1c0-cf84-4206-9a79-5957bc8fda00'
  };

  const WEBHOOK_URL = WEBHOOKS[leadData.lead_type] || WEBHOOKS['Compra'];

  // Helper to remove undefined values for Firestore
  const sanitize = (obj: any): any => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val === undefined) return;
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        newObj[key] = sanitize(val);
      } else {
        newObj[key] = val;
      }
    });
    return newObj;
  };

  const sanitizedData = sanitize({
    ...leadData,
    status: 'new',
    source: 'Qualificador Manos Web App'
  });

  try {
    // 1. Save to Firebase
    const docRef = await addDoc(collection(db, path), {
      ...sanitizedData,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    // 2. Send to Webhook
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sanitizedData,
        firebase_id: docRef.id,
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.error("Webhook error:", err));

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful.");
  } catch (error) {
    console.error("Firebase connection test failed:", error);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration (Client is offline).");
    }
  }
}
