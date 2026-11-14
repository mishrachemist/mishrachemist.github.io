package com.mishrachemist.moltrixerp;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** ERP user ID + password, kept only on this phone: AES-GCM with a key that never leaves the Android Keystore. */
final class Creds {
    private static final String ALIAS = "moltrix_erp_login";
    private final SharedPreferences sp;

    Creds(Context c) { sp = c.getSharedPreferences("erp_login", Context.MODE_PRIVATE); }

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build());
            kg.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
    }

    private static String enc(String plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key());
        byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
    }

    private static String dec(String stored) throws Exception {
        String[] p = stored.split(":", 2);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
        return new String(c.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    boolean save(String id, String pw) {
        try {
            sp.edit().putString("id", enc(id)).putString("pw", enc(pw)).apply();
            return true;
        } catch (Exception e) { return false; }
    }

    void clear() { sp.edit().clear().apply(); }

    boolean has() { return sp.contains("id") && sp.contains("pw"); }

    String id() { return get("id"); }

    String pw() { return get("pw"); }

    private String get(String k) {
        String s = sp.getString(k, null);
        if (s == null) return "";
        try { return dec(s); } catch (Exception e) { return ""; }
    }
}
