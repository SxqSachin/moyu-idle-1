declare module '#auth-utils' {
  interface User {
    // Add your own fields
    uuid: string;
    name: string;
    isVisitor?: boolean;

    isGm?: boolean;

    email?: string;
    emailVerified?: boolean;

    isIronCat: boolean;
  }

  interface UserSession {
    // Add your own fields
  }

  interface SecureSessionData {
    // Add your own fields
  }
}

export {}