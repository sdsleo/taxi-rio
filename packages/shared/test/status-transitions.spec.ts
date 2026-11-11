import { RideStatus, isValidStatusTransition } from '../src/index';

describe('isValidStatusTransition — Regras de Transição de Estado da Corrida', () => {
  describe('Transições válidas permitidas', () => {
    it('deve permitir transição de REQUESTED para ACCEPTED', () => {
      expect(isValidStatusTransition(RideStatus.REQUESTED, RideStatus.ACCEPTED)).toBe(true);
    });

    it('deve permitir transição de REQUESTED para CANCELLED', () => {
      expect(isValidStatusTransition(RideStatus.REQUESTED, RideStatus.CANCELLED)).toBe(true);
    });

    it('deve permitir transição de ACCEPTED para IN_PROGRESS', () => {
      expect(isValidStatusTransition(RideStatus.ACCEPTED, RideStatus.IN_PROGRESS)).toBe(true);
    });

    it('deve permitir transição de ACCEPTED para CANCELLED', () => {
      expect(isValidStatusTransition(RideStatus.ACCEPTED, RideStatus.CANCELLED)).toBe(true);
    });

    it('deve permitir transição de IN_PROGRESS para COMPLETED', () => {
      expect(isValidStatusTransition(RideStatus.IN_PROGRESS, RideStatus.COMPLETED)).toBe(true);
    });

    it('deve permitir transição de IN_PROGRESS para CANCELLED', () => {
      expect(isValidStatusTransition(RideStatus.IN_PROGRESS, RideStatus.CANCELLED)).toBe(true);
    });
  });

  describe('Transições inválidas proibidas', () => {
    it('deve proibir transição direta de REQUESTED para IN_PROGRESS', () => {
      expect(isValidStatusTransition(RideStatus.REQUESTED, RideStatus.IN_PROGRESS)).toBe(false);
    });

    it('deve proibir transição direta de REQUESTED para COMPLETED', () => {
      expect(isValidStatusTransition(RideStatus.REQUESTED, RideStatus.COMPLETED)).toBe(false);
    });

    it('deve proibir transição reversa de IN_PROGRESS para ACCEPTED', () => {
      expect(isValidStatusTransition(RideStatus.IN_PROGRESS, RideStatus.ACCEPTED)).toBe(false);
    });

    it('deve proibir qualquer transição partindo de COMPLETED', () => {
      expect(isValidStatusTransition(RideStatus.COMPLETED, RideStatus.REQUESTED)).toBe(false);
      expect(isValidStatusTransition(RideStatus.COMPLETED, RideStatus.ACCEPTED)).toBe(false);
      expect(isValidStatusTransition(RideStatus.COMPLETED, RideStatus.IN_PROGRESS)).toBe(false);
      expect(isValidStatusTransition(RideStatus.COMPLETED, RideStatus.CANCELLED)).toBe(false);
    });

    it('deve proibir qualquer transição partindo de CANCELLED', () => {
      expect(isValidStatusTransition(RideStatus.CANCELLED, RideStatus.REQUESTED)).toBe(false);
      expect(isValidStatusTransition(RideStatus.CANCELLED, RideStatus.ACCEPTED)).toBe(false);
      expect(isValidStatusTransition(RideStatus.CANCELLED, RideStatus.IN_PROGRESS)).toBe(false);
      expect(isValidStatusTransition(RideStatus.CANCELLED, RideStatus.COMPLETED)).toBe(false);
    });
  });
});
