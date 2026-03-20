/* Ephilium Chatbot - Environment Configuration */
(function () {
  var isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  window.EphiliumChatConfig = {
    backendUrl: isLocal
      ? 'http://localhost:3001'
      : 'https://ephillium-chatbotchatbot-backend.onrender.com',
    debug: isLocal,
  };
})();
