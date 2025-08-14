// Centralized error handling for blockchain services

import type { ServiceError } from './types';

export class BlockchainServiceError extends Error implements ServiceError {
  code?: string;
  statusCode?: number;
  service?: string;

  constructor(message: string, code?: string, statusCode?: number, service?: string) {
    super(message);
    this.name = 'BlockchainServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.service = service;
  }
}

export class ValidationError extends BlockchainServiceError {
  constructor(message: string, service?: string) {
    super(message, 'VALIDATION_ERROR', 400, service);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends BlockchainServiceError {
  constructor(message: string, service?: string) {
    super(message, 'NOT_FOUND', 404, service);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends BlockchainServiceError {
  constructor(message: string, statusCode?: number, service?: string) {
    super(message, 'NETWORK_ERROR', statusCode || 500, service);
    this.name = 'NetworkError';
  }
}

export const isAddressValid = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateAddress = (address: string, service?: string): void => {
  if (!isAddressValid(address)) {
    throw new ValidationError(`Invalid address format: ${address}`, service);
  }
};

export const handleApiError = (error: any, service: string): never => {
  if (error instanceof BlockchainServiceError) {
    throw error;
  }

  if (error.response) {
    const { status, statusText, data } = error.response;
    const message = data?.message || statusText || 'Unknown API error';
    
    switch (status) {
      case 404:
        throw new NotFoundError(message, service);
      case 400:
        throw new ValidationError(message, service);
      default:
        throw new NetworkError(message, status, service);
    }
  }

  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
    throw new NetworkError(`Network error connecting to ${service}`, undefined, service);
  }

  throw new BlockchainServiceError(
    error.message || 'Unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    service
  );
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
  service?: string
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts || error instanceof ValidationError) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }

  throw new BlockchainServiceError(
    `Failed after ${maxAttempts} attempts: ${lastError!.message}`,
    'RETRY_EXHAUSTED',
    500,
    service
  );
};