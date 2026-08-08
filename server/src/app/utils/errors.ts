export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string = "UNAUTHORIZED", message: string = "Authentication required.") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string = "FORBIDDEN_OPERATION", message: string = "Operation not permitted.") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string = "RESOURCE_NOT_FOUND", message: string = "Resource not found.") {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string = "RESOURCE_CONFLICT", message: string = "Resource conflict.") {
    super(409, code, message);
  }
}

export class HardwareError extends AppError {
  constructor(code: string = "HARDWARE_FAULT", message: string = "Hardware subsystem failure.") {
    super(502, code, message);
  }
}

export class InternalServerError extends AppError {
  constructor(code: string = "INTERNAL_SERVER_ERROR", message: string = "An unexpected server error occurred.") {
    super(500, code, message);
  }
}
