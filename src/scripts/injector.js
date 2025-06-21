window.addEventListener('message', async (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.type === 'PROOFMAILSIGN') {
    if (!window.solana || !window.solana.connect || !window.solana.signMessage) {
      window.postMessage({
        type: 'PROOFMAILSIGNFAILED',
        message: 'Solana wallet not found. Please install a Solana wallet extension.'
      });
      return;
    }

    const message = event.data.message;

    if (!message) {
      window.postMessage({
        type: 'PROOFMAILSIGNFAILED',
        message: 'No message provided.'
      });
      return;
    }

    if (!message.bodyHash || !message.email) {
      window.postMessage({
        type: 'PROOFMAILSIGNFAILED',
        message: 'Message must contain bodyHash, email.'
      });
      return;
    }

    try {
      await window.solana.connect();
      const signed = await window.solana.signMessage(
        new TextEncoder().encode(
          `ProofMail-${message.email}-${message.bodyHash}`
        ),
        'utf8'
      );

      window.postMessage({
        type: 'PROOFMAILSIGNED',
        publicKey: signed.publicKey.toString(),
        signature: btoa(String.fromCharCode(...signed.signature)),
        bodyHash: message.bodyHash,
        email: message.email
      }, '*');
    } catch (err) {
      console.error('ProofMail sign error:', err);
      window.postMessage({
          type: 'PROOFMAILSIGNFAILED',
          message: 'Signature failed. Please ensure you are connected to a Solana wallet.'
      });
    }
  }
});
