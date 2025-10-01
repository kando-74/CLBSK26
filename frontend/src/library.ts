import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()

interface AddLibraryEntryData {
  eventId: string
  language: string
  bggId?: number
  bggData?: {
    name: string
    thumbnail?: string
    yearPublished?: number
  }
  manualTitle?: string
}

/**
 * Función Callable para añadir un nuevo juego a la ludoteca de un evento.
 * Se encarga de las validaciones de seguridad y duplicados.
 */
export const addLibraryEntry = functions
  .region('europe-west1')
  .https.onCall(async (data: AddLibraryEntryData, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes estar autenticado para añadir un juego.')
    }

    const { uid } = context.auth
    const { eventId, language, bggId, bggData, manualTitle } = data

    // 2. Validar datos de entrada
    if (!eventId || (!bggId && !manualTitle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Faltan datos para añadir el juego (eventId, bggId o manualTitle).')
    }

    // 3. Obtener el alias del usuario
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'No se encontró tu perfil de usuario.')
    }
    const ownerAlias = userDoc.data()?.alias || 'Anónimo'

    const libraryCollection = db.collection('events').doc(eventId).collection('libraryEntries')

    // 4. Comprobar duplicados (mismo juego y mismo propietario)
    const duplicateQuery = bggId
      ? libraryCollection.where('bggId', '==', bggId).where('ownerUid', '==', uid)
      : libraryCollection.where('manualTitle', '==', manualTitle).where('ownerUid', '==', uid)

    const duplicateSnapshot = await duplicateQuery.get()
    if (!duplicateSnapshot.empty) {
      throw new functions.https.HttpsError('already-exists', 'Ya has añadido este juego a la ludoteca del evento.')
    }

    // 5. Construir y guardar la nueva entrada
    const newEntry = {
      ownerUid: uid,
      ownerAlias,
      language: language || 'N/D',
      manual: !bggId,
      bggId: bggId || null,
      bggData: bggData || null,
      manualTitle: manualTitle || bggData?.name || 'Título no disponible',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    try {
      const docRef = await libraryCollection.add(newEntry)
      return { success: true, entryId: docRef.id, message: 'Juego añadido correctamente.' }
    } catch (error) {
      console.error('Error al añadir juego a la ludoteca:', error)
      throw new functions.https.HttpsError('internal', 'No se pudo guardar el juego en la base de datos.')
    }
  })