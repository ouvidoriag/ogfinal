/**
 * Simple Loading Animation
 * Animação simples de carregamento - apenas texto e linha reta
 */

class CityLoadingAnimation {
  constructor(containerId = 'city-loading-container') {
    this.container = document.getElementById(containerId);
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.progress = 0;
    this.isAnimating = false;
    this.time = 0;
    
    this.init();
  }
  
  init() {
    if (!this.container) {
      console.warn('Container de loading não encontrado');
      return;
    }
    
    // Criar canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'city-loading-canvas';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    // Configurar tamanho do canvas
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Iniciar animação
    this.start();
  }
  
  resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width || window.innerWidth;
    this.canvas.height = rect.height || window.innerHeight;
  }
  
  start() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.progress = 0;
    this.animate();
  }
  
  animate() {
    if (!this.isAnimating) return;
    
    this.time += 0.016; // Incrementar tempo (aproximadamente 60fps)
    
    // Limpar canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calcular progresso baseado no tempo (animação contínua)
    if (this.progress < 0.95) {
      // Velocidade variável: mais rápido no meio, mais lento no início e fim
      let speed = this.progress < 0.3 ? 0.005 : (this.progress < 0.8 ? 0.012 : 0.003);
      
      // Se chegou perto de 95%, desacelerar muito
      if (this.progress >= 0.85) {
        speed = 0.001; // Muito lento
      }
      
      this.progress += speed;
      this.progress = Math.min(0.95, this.progress); // Limitar a 95% até sistema carregar
    }
    
    // Desenhar linha reta simples
    this.drawLine();
    
    // Continuar animação
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  drawLine() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const lineLength = 400;
    const lineWidth = 2;
    const lineColor = '#22d3ee';
    
    // Desenhar linha horizontal simples
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - lineLength / 2, centerY);
    this.ctx.lineTo(centerX + lineLength / 2, centerY);
    this.ctx.stroke();
    
    // Efeito de brilho na linha
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'rgba(34, 211, 238, 0.6)';
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }
  
  stop() {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  hide() {
    // Parar a animação normal
    this.isAnimating = false;
    
    // Completar animação até 100% rapidamente antes de esconder
    const completeAnimation = () => {
      if (this.progress < 1) {
        this.progress = Math.min(1, this.progress + 0.1); // Completar rapidamente
        
        // Atualizar visual
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawLine();
        
        // Continuar até 100%
        requestAnimationFrame(completeAnimation);
      } else {
        // Agora sim esconder
        if (this.container) {
          this.container.style.opacity = '0';
          this.container.style.transition = 'opacity 0.5s ease-out';
          this.container.style.pointerEvents = 'none';
          setTimeout(() => {
            this.container.style.display = 'none';
            this.container.style.visibility = 'hidden';
            this.stop();
            
            // Garantir que o body e outros elementos estejam visíveis
            document.body.style.overflow = '';
            const pagesContainer = document.getElementById('pages');
            if (pagesContainer) {
              pagesContainer.style.display = '';
            }
          }, 500);
        }
      }
    };
    
    completeAnimation();
  }
  
  destroy() {
    this.stop();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Exportar para uso global
window.CityLoadingAnimation = CityLoadingAnimation;

// Auto-inicializar quando DOM estiver pronto
function initCityLoading() {
  const container = document.getElementById('city-loading-container');
  if (container && !window.cityLoading) {
    try {
      window.cityLoading = new CityLoadingAnimation();
      if (window.Logger) {
        window.Logger.debug('🔍 City Loading Animation inicializada');
      }
    } catch (error) {
      console.error('Erro ao inicializar City Loading Animation:', error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCityLoading);
} else {
  // Se DOM já está pronto, inicializar imediatamente
  setTimeout(initCityLoading, 100);
}

