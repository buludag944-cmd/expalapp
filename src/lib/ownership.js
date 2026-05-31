function isOwnerOrAdmin(user, ownerId) {
  if (!user?.id) return false;
  return Number(ownerId) === Number(user.id) || !!user.isAdmin;
}

function isCommentAuthorOrAdmin(user, comment) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!comment?.author || !user.email) return false;
  return String(comment.author).toLowerCase() === String(user.email).toLowerCase();
}

module.exports = { isOwnerOrAdmin, isCommentAuthorOrAdmin };
