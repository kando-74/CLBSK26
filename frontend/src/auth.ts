import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

/**
 * Función Callable para verificar si un email está en la whitelist.
 * El frontend la llama ANTES de intentar crear o loguear un usuario.
 */
export const checkWhitelist = functions
  .region('europe-west1') // Usa la región que prefieras
  .https.onCall(async (data, context) => {
    const email = data.email

    if (!email || typeof email !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'La función debe ser llamada con un "email".',
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const whitelistRef = db.collection('authorizedEmails').doc(normalizedEmail)
    const doc = await whitelistRef.get()

    if (!doc.exists) {
      return { isAuthorized: false }
    }

    return { isAuthorized: true, role: doc.data()?.role || 'asistente' }
  })