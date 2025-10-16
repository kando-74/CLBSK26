import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: 'AIzaSyDL-p8kwxB4vn3rO0DUL-eBFFsAmGZ-MpY',
  authDomain: 'clbsk26.firebaseapp.com',
  projectId: 'clbsk26',
  storageBucket: 'clbsk26.firebasestorage.app',
  messagingSenderId: '314239716156',
  appId: '1:314239716156:web:e142bcb20e760cb1fd2c39',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, 'us-central1')

// Set auth persistence
setPersistence(auth, browserLocalPersistence)

// Debug information
console.log('Firebase initialized with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey ? 'API_KEY_PRESENT' : 'API_KEY_MISSING'
})

export default app