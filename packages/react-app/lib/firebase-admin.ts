import admin from "firebase-admin"

function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required Firebase env var: ${name}`)
    }
    return value
}

function getDb() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: getRequiredEnv("FIREBASE_PROJECT_ID"),
                clientEmail: getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
                privateKey: getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
            }),
            databaseURL: getRequiredEnv("FIREBASE_DATABASE_URL"),
        })
    }
    return admin.database()
}

export const db = {
    ref(path: string) {
        return getDb().ref(path)
    }
}