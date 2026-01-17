const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');

// Intentar usar las credenciales por defecto (gcloud auth application-default login)
try {
    admin.initializeApp({
        credential: applicationDefault(),
        projectId: 'clbsk26'
    });
} catch (e) {
    console.log('Advertencia: No se pudo inicializar con credenciales por defecto.');
    console.log('Asegurate de ejecutar "gcloud auth application-default login" antes.');
    // Fallback inseguro si no hay credenciales, probablemente fallará en producción
    admin.initializeApp({ projectId: 'clbsk26' });
}

const db = admin.firestore();
const email = 'alejandro.martin.millan@gmail.com';

async function seedAdmin() {
    console.log(`Adding ${email} to authorizedEmails...`);
    try {
        await db.collection('authorizedEmails').doc(email).set({
            email: email,
            role: 'organizacion',
            status: 'approved',
            invitedBy: 'system_seed',
            displayName: 'Alejandro',
            notes: 'Admin seeded via script',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Success! User added as organizacion.');
    } catch (error) {
        console.error('Error adding user:', error);
        console.log('\nAudit hint: Run this in a terminal where you have run "gcloud auth application-default login".');
    }
}

seedAdmin();
