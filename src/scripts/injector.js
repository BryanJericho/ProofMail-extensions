window.addEventListener("message", async (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.type === "PROOFMAILSIGN") {
    if (!window.solana || !window.solana.connect || !window.solana.signMessage) {
      alert("❌ Solana wallet not detected. Please install a Solana wallet extension.");
      return;
    }

    const message = event.data.message;

    if (!message || message.trim() === "") {
      alert("❌ No message to sign. Please ensure the email body is not empty.");
      return;
    }

    try {
      await window.solana.connect();
      const signed = await window.solana.signMessage(
        new TextEncoder().encode(message),
        "utf8"
      );

      window.postMessage({
        type: "PROOFMAILSIGNED",
        signature: btoa(String.fromCharCode(...signed.signature)),
        publicKey: signed.publicKey.toString()
      }, "*");
    } catch (err) {
      alert("❌ Signature failed. Please ensure you are connected to a Solana wallet.");
    }
  }
});
