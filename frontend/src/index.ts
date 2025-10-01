/**
 * Este archivo es el punto de entrada para todas las Cloud Functions.
 * Desde aquí se exportan todas las funciones que se desplegarán en Firebase.
 */

import * as admin from 'firebase-admin'
admin.initializeApp()

export { checkWhitelist } from './auth'
export { addLibraryEntry } from './library'