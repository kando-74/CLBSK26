import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyDL-p8kwxB4vn3rO0DUL-eBFFsAmGZ-MpY',
  authDomain: 'clbsk26.firebaseapp.com',
  projectId: 'clbsk26',
  storageBucket: 'clbsk26.firebasestorage.app',
  messagingSenderId: '314239716156',
  appId: '1:314239716156:web:e142bcb20e760cb1fd2c39',
};

const app = initializeApp(firebaseConfig, 'cli-test');
const functions = getFunctions(app, 'us-central1');

const addLibraryEntry = httpsCallable(functions, 'addLibraryEntry');

try {
  const response = await addLibraryEntry({
    entry: {
      id: 'bgg-342942',
      title: 'Ark Nova',
      owner: 'CLI User',
      ownerId: 'cli-user-id',
      players: '1-4',
      duration: '90-150 min',
      weight: '3.7',
      language: 'BGG',
      mechanics: ['Economic', 'Hand Management'],
      coverUrl: 'https://example.com/arknova.jpg',
      manual: false,
    },
    bggId: 342942,
  });
  console.log('Callable response:', response.data);
} catch (error) {
  console.error('Callable error:', error);
}
