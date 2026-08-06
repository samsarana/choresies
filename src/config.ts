/**
 * Firebase web-app config — paste the values from FIREBASE-SETUP.md step 6.
 *
 * While this is null, Choresies runs in DEMO MODE: fully functional, but data
 * lives only on this device and isn't shared with the rest of the household.
 */
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

export const firebaseConfig: FirebaseConfig | null = {
  apiKey: 'AIzaSyDGbdiv2Z9NktHXrpPBneiYSQtjiSV1x7I',
  authDomain: 'choresies-bbf67.firebaseapp.com',
  projectId: 'choresies-bbf67',
  storageBucket: 'choresies-bbf67.firebasestorage.app',
  messagingSenderId: '863059310603',
  appId: '1:863059310603:web:782d2a651043c48aadaf0e',
}
