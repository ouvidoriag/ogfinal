/**
 * Script para criar usuários iniciais no banco de dados
 * 
 * Usuários criados:
 * - master (senha: ouv2025)
 * - rildo, nikolas, hedrizio, nilton, david (senha: ouv2025)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const users = [
  { username: 'master', password: 'ouv2025' },
  { username: 'rildo', password: 'ouv2025' },
  { username: 'nikolas', password: 'ouv2025' },
  { username: 'hedrizio', password: 'ouv2025' },
  { username: 'nilton', password: 'ouv2025' },
  { username: 'david', password: 'ouv2025' }
];

async function createUsers() {
  try {
    console.log('🔐 Iniciando criação de usuários...\n');

    for (const userData of users) {
      const { username, password } = userData;

      // Verificar se usuário já existe
      const existingUser = await prisma.user.findUnique({
        where: { username: username.toLowerCase() }
      });

      if (existingUser) {
        console.log(`⚠️  Usuário "${username}" já existe. Pulando...`);
        continue;
      }

      // Hash da senha
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const user = await prisma.user.create({
        data: {
          username: username.toLowerCase(),
          password: hashedPassword
        }
      });

      console.log(`✅ Usuário "${username}" criado com sucesso!`);
    }

    console.log('\n✨ Processo concluído!');
    
    // Listar todos os usuários
    const allUsers = await prisma.user.findMany({
      select: {
        username: true,
        createdAt: true
      }
    });

    console.log(`\n📋 Total de usuários no banco: ${allUsers.length}`);
    console.log('Usuários:', allUsers.map(u => u.username).join(', '));

  } catch (error) {
    console.error('❌ Erro ao criar usuários:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createUsers();

