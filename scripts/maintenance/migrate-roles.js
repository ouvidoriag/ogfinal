/**
 * Migration: Inicializar Roles RBAC
 * Data: 09/01/2026
 * 
 * Define todos os usuários existentes como 'admin' para evitar lockout.
 * Uso: node scripts/maintenance/migrate-roles.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import User from '../../src/models/User.model.js';

async function migrate() {
    try {
        console.log('🚀 Iniciando migração de roles...\n');

        // Conectar ao Banco
        const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
        await initializeDatabase(mongoUrl);
        console.log('✅ Conectado ao banco de dados');

        // Buscar usuários sem role ou com role antiga
        const users = await User.find({});

        console.log(`📊 Total de usuários encontrados: ${users.length}`);

        let updated = 0;

        for (const user of users) {
            // Se não tiver role, define como admin (segurança inicial de migração)
            if (!user.role) {
                user.role = 'admin';
                await user.save();
                console.log(`✅ Usuário ${user.username} atualizado para ADMIN`);
                updated++;
            } else {
                console.log(`ℹ️ Usuário ${user.username} já possui role: ${user.role}`);
            }
        }

        console.log(`\n🎉 Migração concluída! ${updated} usuários atualizados.`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexão fechada.');
    }
}

migrate();
