import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';

export type User = {
  uid: string;
  alias: string;
  email: string;
};

type UseUsersState = {
  users: User[];
  loading: boolean;
  error: string | null;
};

const usersCollectionRef = collection(db, 'users');

async function listUsers(): Promise<User[]> {
  try {
    const snapshot = await getDocs(usersCollectionRef);
    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        alias: data.alias ?? 'Sin alias',
        email: data.email ?? 'Sin correo',
      };
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error('No se pudo obtener la lista de usuarios.');
  }
}

export function useUsers(): UseUsersState {
  const [state, setState] = useState<UseUsersState>({
    users: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    listUsers()
      .then((users) => {
        if (!cancelled) {
          setState({ users, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ users: [], loading: false, error: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
