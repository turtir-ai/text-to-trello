import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TrelloOAuthManager {
  constructor() {
    this.clientId = process.env.TRELLO_CLIENT_ID;
    this.clientSecret = process.env.TRELLO_CLIENT_SECRET;
    this.callbackURL = process.env.TRELLO_OAUTH_CALLBACK_URL;
    this.isEnabled = process.env.TRELLO_OAUTH_ENABLED === 'true';
    
    if (this.isEnabled) {
      this.initializeOAuth();
      console.log('✅ OAuth 2.0 desteği aktif');
    } else {
      console.log('📝 OAuth 2.0 devre dışı - API Key kullanılıyor');
    }
  }

  initializeOAuth() {
    // Trello OAuth 2.0 stratejisi
    passport.use('trello', new OAuth2Strategy({
      authorizationURL: 'https://trello.com/1/OAuthAuthorizeToken',
      tokenURL: 'https://trello.com/1/OAuthGetAccessToken',
      clientID: this.clientId,
      clientSecret: this.clientSecret,
      callbackURL: this.callbackURL,
      scope: 'read,write'
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Kullanıcı bilgilerini al
        const userResponse = await axios.get('https://api.trello.com/1/members/me', {
          headers: {
            'Authorization': `OAuth oauth_consumer_key="${this.clientId}", oauth_token="${accessToken}"`
          }
        });

        const user = {
          id: userResponse.data.id,
          username: userResponse.data.username,
          fullName: userResponse.data.fullName,
          accessToken: accessToken,
          refreshToken: refreshToken
        };

        return done(null, user);
      } catch (error) {
        console.error('OAuth kullanıcı bilgileri alınırken hata:', error);
        return done(error, null);
      }
    }));

    // Kullanıcı serileştirme
    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, user);
    });
  }

  /**
   * OAuth middleware'lerini Express app'e ekler
   */
  setupRoutes(app) {
    if (!this.isEnabled) {
      console.log('⚠️ OAuth devre dışı - route eklenmedi');
      return;
    }

    // Session middleware
    app.use(require('express-session')({
      secret: process.env.TRELLO_CLIENT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Development için false, production'da true yapın
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
      }
    }));

    // Passport middleware
    app.use(passport.initialize());
    app.use(passport.session());

    // OAuth route'ları
    app.get('/auth/trello', passport.authenticate('trello'));

    app.get('/auth/trello/callback',
      passport.authenticate('trello', { failureRedirect: '/auth/error' }),
      (req, res) => {
        // Başarılı authentication
        console.log('✅ OAuth authentication başarılı:', req.user.username);
        res.redirect('/auth/success');
      }
    );

    app.get('/auth/success', (req, res) => {
      if (!req.isAuthenticated()) {
        return res.redirect('/auth/trello');
      }

      res.json({
        success: true,
        message: 'OAuth authentication başarılı!',
        user: {
          username: req.user.username,
          fullName: req.user.fullName,
          id: req.user.id
        }
      });
    });

    app.get('/auth/error', (req, res) => {
      res.json({
        success: false,
        message: 'OAuth authentication başarısız!',
        error: 'Authentication failed'
      });
    });

    app.get('/auth/logout', (req, res) => {
      req.logout((err) => {
        if (err) {
          return res.json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Logout başarılı' });
      });
    });

    app.get('/auth/status', (req, res) => {
      res.json({
        authenticated: req.isAuthenticated(),
        user: req.user || null,
        oauthEnabled: this.isEnabled
      });
    });

    console.log('✅ OAuth route eklendi:');
    console.log('   🔐 /auth/trello - Giriş');
    console.log('   ✅ /auth/success - Başarılı');
    console.log('   ❌ /auth/error - Hata');
    console.log('   🚪 /auth/logout - Çıkış');
    console.log('   📊 /auth/status - Durum');
  }

  /**
   * Authentication middleware
   */
  requireAuth(req, res, next) {
    if (!this.isEnabled) {
      // OAuth devre dışıysa direkt geç
      return next();
    }

    if (req.isAuthenticated()) {
      return next();
    }

    // API anahtarı kontrolü (fallback)
    const apiKey = req.headers['x-api-key'] || req.query.key;
    const token = req.headers['x-token'] || req.query.token;

    if (apiKey && token) {
      // Manual API key authentication
      req.trelloCredentials = { apiKey, token };
      return next();
    }

    res.status(401).json({
      error: 'Authentication required',
      message: 'OAuth authentication gerekli veya API key/token sağlanmalı',
      authUrl: '/auth/trello'
    });
  }

  /**
   * Kullanıcının access token'ını al
   */
  getAccessToken(req) {
    if (req.user && req.user.accessToken) {
      return req.user.accessToken;
    }
    
    // Fallback olarak environment'tan al
    return process.env.TRELLO_TOKEN;
  }

  /**
   * OAuth ile API isteği yap
   */
  async makeAuthenticatedRequest(req, method, endpoint, data = {}) {
    const accessToken = this.getAccessToken(req);
    const apiKey = req.trelloCredentials?.apiKey || process.env.TRELLO_API_KEY;

    const config = {
      method: method.toLowerCase(),
      url: `https://api.trello.com/1${endpoint}`,
      headers: {},
      params: {
        key: apiKey,
        token: accessToken
      }
    };

    if (method.toLowerCase() === 'get') {
      config.params = { ...config.params, ...data };
    } else {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`OAuth API İsteği Hatası: ${method} ${endpoint}`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * OAuth durumunu kontrol et
   */
  getAuthStatus(req) {
    return {
      oauthEnabled: this.isEnabled,
      authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      user: req.user || null,
      hasApiKey: !!(req.trelloCredentials?.apiKey || process.env.TRELLO_API_KEY),
      hasToken: !!(req.trelloCredentials?.token || this.getAccessToken(req))
    };
  }
}

// Singleton instance
let oauthManagerInstance = null;

export function getOAuthManager() {
  if (!oauthManagerInstance) {
    oauthManagerInstance = new TrelloOAuthManager();
  }
  return oauthManagerInstance;
}
