import { AppError, toErrorBody } from '../shared/errors.js'

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API không tồn tại.',
      details: [],
    },
  })
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  // JSON không hợp lệ
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu JSON không hợp lệ.',
        details: [],
      },
    })
  }

  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dung lượng tệp tải lên vượt quá giới hạn cho phép.',
        details: [],
      },
    })
  }

  if (!(err instanceof AppError)) {
    console.error('[API ERROR]', err)
  }

  const status = err instanceof AppError ? err.httpStatus : 500

  return res.status(status).json(toErrorBody(err))
}
