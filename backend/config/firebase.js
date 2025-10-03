const admin = require('firebase-admin');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK with comprehensive error handling and fallbacks
 */
const initializeFirebase = () => {
    try {
        if (!firebaseApp) {
            // Check if we have the required environment variables
            if (!process.env.FIREBASE_PROJECT_ID) {
                console.warn('⚠️  Firebase not configured. Using mock data mode for development/testing.');
                console.warn('   To configure Firebase for production:');
                console.warn('   1. Set FIREBASE_PROJECT_ID in your .env file');
                console.warn('   2. Provide credentials via one of these methods:');
                console.warn('      - GOOGLE_APPLICATION_CREDENTIALS (JSON file path)');
                console.warn('      - FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL (environment variables)');
                console.warn('      - Application Default Credentials (for Google Cloud)');
                return null;
            }

            let credential;
            let credentialSource = 'unknown';
            
            // Try to use private key file if provided (legacy method)
            if (process.env.FIREBASE_PRIVATE_KEY_PATH) {
                try {
                    const serviceAccount = require(process.env.FIREBASE_PRIVATE_KEY_PATH);
                    credential = admin.credential.cert(serviceAccount);
                    credentialSource = 'FIREBASE_PRIVATE_KEY_PATH';
                    console.log('🔧 Using Firebase credentials from FIREBASE_PRIVATE_KEY_PATH');
                } catch (error) {
                    console.warn('⚠️  Firebase private key file not found:', error.message);
                    console.warn('   Check if the file exists and has correct permissions');
                }
            }

            // Try GOOGLE_APPLICATION_CREDENTIALS (recommended for JSON file method)
            if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                try {
                    const path = require('path');
                    const serviceAccountPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
                    console.log(`🔧 Attempting to load Firebase credentials from: ${serviceAccountPath}`);
                    
                    // Check if file exists before requiring it
                    const fs = require('fs');
                    if (!fs.existsSync(serviceAccountPath)) {
                        throw new Error(`Service account key file not found: ${serviceAccountPath}`);
                    }
                    
                    const serviceAccount = require(serviceAccountPath);
                    
                    // Validate the service account JSON structure
                    if (!serviceAccount.private_key || !serviceAccount.client_email) {
                        throw new Error('Invalid service account key: missing required fields (private_key, client_email)');
                    }
                    
                    credential = admin.credential.cert(serviceAccount);
                    credentialSource = 'GOOGLE_APPLICATION_CREDENTIALS';
                    console.log('🔧 Using Firebase credentials from GOOGLE_APPLICATION_CREDENTIALS');
                } catch (error) {
                    console.warn('⚠️  Firebase credentials file error:', error.message);
                    console.warn('   Please verify:');
                    console.warn('   1. File exists and is readable');
                    console.warn('   2. File contains valid JSON');
                    console.warn('   3. File has correct permissions (600 recommended)');
                    console.warn('   4. File contains a valid Firebase service account key');
                }
            }

            // If no private key file, try environment variables
            if (!credential && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
                try {
                    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
                    
                    // Build service account object with all available fields
                    const serviceAccountConfig = {
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        privateKey: privateKey,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    };

                    // Add optional fields if available
                    if (process.env.FIREBASE_TYPE) {
                        serviceAccountConfig.type = process.env.FIREBASE_TYPE;
                    }
                    if (process.env.FIREBASE_PRIVATE_KEY_ID) {
                        serviceAccountConfig.privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;
                    }
                    if (process.env.FIREBASE_CLIENT_ID) {
                        serviceAccountConfig.clientId = process.env.FIREBASE_CLIENT_ID;
                    }
                    if (process.env.FIREBASE_AUTH_URI) {
                        serviceAccountConfig.authUri = process.env.FIREBASE_AUTH_URI;
                    }
                    if (process.env.FIREBASE_TOKEN_URI) {
                        serviceAccountConfig.tokenUri = process.env.FIREBASE_TOKEN_URI;
                    }
                    if (process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL) {
                        serviceAccountConfig.authProviderX509CertUrl = process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL;
                    }
                    if (process.env.FIREBASE_CLIENT_X509_CERT_URL) {
                        serviceAccountConfig.clientX509CertUrl = process.env.FIREBASE_CLIENT_X509_CERT_URL;
                    }
                    if (process.env.FIREBASE_UNIVERSE_DOMAIN) {
                        serviceAccountConfig.universeDomain = process.env.FIREBASE_UNIVERSE_DOMAIN;
                    }

                    credential = admin.credential.cert(serviceAccountConfig);
                    credentialSource = 'Environment Variables';
                    console.log('🔧 Using Firebase credentials from environment variables including:', Object.keys(serviceAccountConfig).filter(key => serviceAccountConfig[key]).join(', '));
                } catch (error) {
                    console.warn('⚠️  Failed to create Firebase credentials from environment variables:', error.message);
                    console.warn('   Please verify FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL are correctly set');
                }
            }

            // Initialize with Application Default Credentials if available
            if (!credential) {
                try {
                    console.log('🔧 Attempting to use Firebase Application Default Credentials');
                    credential = admin.credential.applicationDefault();
                    credentialSource = 'Application Default Credentials';
                } catch (credError) {
                    console.warn('⚠️  Firebase credentials not available. Using mock data mode for development/testing.');
                    console.warn('   To use Firebase in production, configure credentials using one of these methods:');
                    console.warn('   1. JSON file: Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json');
                    console.warn('   2. Environment vars: Set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL');
                    console.warn('   3. Google Cloud: Use Application Default Credentials');
                    console.warn('   For setup instructions: https://cloud.google.com/docs/authentication/getting-started');
                    return null;
                }
            }

            firebaseApp = admin.initializeApp({
                credential: credential,
                projectId: process.env.FIREBASE_PROJECT_ID,
            });

            console.log(`✅ Firebase Admin SDK initialized successfully using ${credentialSource}`);
            console.log(`📱 Connected to Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
        }
        return firebaseApp;
    } catch (error) {
        console.warn('⚠️  Failed to initialize Firebase, using mock data mode:', error.message);
        console.warn('   Common issues:');
        console.warn('   1. Invalid service account key format');
        console.warn('   2. Incorrect project ID');
        console.warn('   3. Network connectivity issues');
        console.warn('   4. Insufficient permissions in Firebase project');
        console.warn('   Application will continue with mock data for development/testing');
        return null;
    }
};

/**
 * Get Firestore database instance
 */
const getFirestore = () => {
    if (!firebaseApp) {
        console.warn('⚠️  Firebase not initialized');
        return null;
    }
    return admin.firestore();
};

/**
 * Get Firebase Auth instance
 */
const getAuth = () => {
    if (!firebaseApp) {
        console.warn('⚠️  Firebase not initialized');
        return null;
    }
    return admin.auth();
};

module.exports = {
    initializeFirebase,
    getFirestore,
    getAuth,
    admin
};