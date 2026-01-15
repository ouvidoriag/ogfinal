/**
 * Rotas para Integração com API do Colab
 * Documentação: https://public-api-doc.colabapp.com/
 */

import express from 'express';
import {
  getCategories,
  getPosts,
  getPostById,
  createPost,
  acceptPost,
  rejectPost,
  solvePost,
  createComment,
  getComments,
  getEventById,
  acceptEvent,
  solveEvent,
  receiveWebhook
} from '../controllers/colabController.js';

export default function colabRoutes() {
  const router = express.Router();
  
  // Categorias
  router.get('/categories', getCategories);
  
  // Demandas (Posts)
  router.get('/posts', getPosts);
  router.get('/posts/:id', getPostById);
  router.post('/posts', createPost);
  router.post('/posts/:id/accept', acceptPost);
  router.post('/posts/:id/reject', rejectPost);
  router.post('/posts/:id/solve', solvePost);
  router.post('/posts/:id/comment', createComment);
  router.get('/posts/:id/comments', getComments);
  
  // Demandas (Events)
  router.get('/events/:id', getEventById);
  router.post('/events/:id/accept', acceptEvent);
  router.post('/events/:id/solve', solveEvent);
  
  // Webhooks
  router.post('/webhooks', receiveWebhook);
  
  return router;
}

