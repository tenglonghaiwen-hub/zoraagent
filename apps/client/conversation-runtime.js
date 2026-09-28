export function canRecoverConversation(conversation, message, activity) {
  if (!activity?.conversationId || !activity.messageId || activity.messageId !== message.id) return false;
  if (conversation.backendId) return conversation.backendId === activity.conversationId;
  // Copied branch history is not an in-flight request from the new conversation.
  return !message.inheritedFromMessageId && Boolean(message.pending || message.recovering);
}

export function branchMessage(message, newId) {
  return {...message, id: newId, inheritedFromMessageId: message.id,
    pending: false, recovering: false};
}
