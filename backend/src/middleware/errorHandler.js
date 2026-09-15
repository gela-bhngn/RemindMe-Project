export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === "ER_ACCESS_DENIED_ERROR" || error.code === "ER_DBACCESS_DENIED_ERROR") {
    return res.status(503).json({
      message: "Database connection failed. Verify MYSQL_USER and MYSQL_PASSWORD in backend/.env, then grant that user access in SQLyog."
    });
  }
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Something went wrong",
    detail: process.env.NODE_ENV === "production" ? undefined : error.message
  });
}
