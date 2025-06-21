import bs58 from 'bs58';
import nacl from 'tweetnacl';

window.bs58 = bs58;
window.nacl = nacl;

const script = document.createElement("script");
script.src = chrome.runtime.getURL("./src/scripts/injector.js");
script.type = "module";
(document.head || document.documentElement).appendChild(script);

const toolbarMutationObserver = new MutationObserver(async () => {
  const toolbar = document.querySelector(".aeJ") || document.querySelector(".aDh") || document.querySelector('[gh="mtb"]');
  if (!toolbar) {
    return;
  }

  const existingButton = document.getElementById("proofmail-sign-btn");
  if (existingButton) {
    return;
  }

  const button = document.createElement("button");
  button.innerText = "ProofMail Sign Email";
  button.id = "proofmail-sign-btn";

  button.style.cssText = `
    margin: 8px;
    margin-left: 15px;
    padding: 8px 16px;
    border: none;
    background: linear-gradient(45deg, #007BFF 0%, #0056b3 100%);
    color: white;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  `;

  button.onmouseover = () => {
    button.style.background = 'linear-gradient(45deg, #0056b3 0%, #003F80 100%)';
    button.style.transform = 'translateY(-1px)';
    button.style.boxShadow = '0 6px 15px rgba(0, 123, 255, 0.4)';
  };

  button.onmouseout = () => {
    button.style.background = 'linear-gradient(45deg, #007BFF 0%, #0056b3 100%)';
    button.style.transform = 'none';
    button.style.boxShadow = '0 4px 10px rgba(0, 123, 255, 0.2)';
  };

  button.onclick = () => {
    const emailBody = document.querySelector('.Am.Al.editable');
    if (!emailBody) {
      alert("Email body not found");
      return;
    }

    const message = emailBody.innerText;

    window.postMessage({
      type: "PROOFMAILSIGN",
      message: message
    }, "*");
  };

  toolbar.prepend(button);
});

toolbarMutationObserver.observe(document.body, {
  childList: true,
  subtree: true
});

window.addEventListener("message", async (event) => {
  if (event.data.type === "PROOFMAILSIGNED") {
    const emailBodyEl = document.querySelector('.Am.Al.editable');
    if (!emailBodyEl) {
      alert("Email body not found");
      return;
    }

    const sig = event.data.signature;
    const pubKey = event.data.publicKey;

    const signatureBlock = `\n\n---\nSigned by: ${pubKey}\nSignature: ${sig}\n---`;
    emailBodyEl.innerText += signatureBlock;

    alert("✅ Email signed and footer added!");
  }
});

async function fetchUserFromPublicKey(pubKey) {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/by-pubkey/${pubKey}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.status !== 200) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

const BADGE_BASE_STYLE = `
  padding: 10px 15px;
  color: white;
  border-radius: 8px;
  margin-left: 15px;
  margin-top: 15px;
  margin-bottom: 15px;
  font-size: 14px;
  line-height: 1.4;
`;

function createSuccessBadge(senderName, pubKey) {
  return `<div style="
    ${BADGE_BASE_STYLE}
    background: linear-gradient(90deg, #22c55e 0%, #15803d 100%); /* Gradien hijau */
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); /* Glow hijau */
    border: 1px solid rgba(34, 197, 94, 0.6);
    ">
    ✅ ProofMail: Valid signature from <strong>${senderName}</strong><br>
    🔗 Wallet: ${pubKey.slice(0, 8)}...
  </div>`;
}

function createWarningBadge(senderName) {
  return `<div style="
    ${BADGE_BASE_STYLE}
    background: linear-gradient(90deg, #fbbf24 0%, #b45309 100%); /* Gradien kuning */
    box-shadow: 0 4px 15px rgba(250, 186, 36, 0.4); /* Glow kuning */
    border: 1px solid rgba(250, 186, 36, 0.6);
    ">
    ⚠️ ProofMail: Valid signature from <strong>${senderName}</strong> (non-trusted)<br>
  </div>`;
}

function createErrorBadge(message, senderName = null) {
  const content = senderName
    ? `❌ ProofMail: Invalid signature from <strong>${senderName}</strong><br>`
    : `❌ ProofMail: ${message}<br>`;

  return `<div style="
    ${BADGE_BASE_STYLE}
    background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%); /* Gradien merah */
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); /* Glow merah */
    border: 1px solid rgba(239, 68, 68, 0.6);
    ">
    ${content}
  </div>`;
}

function createBadgeElement(elementContent = null) {
  const oldBadge = document.querySelector("#proofmail-verify-badge");
  if (oldBadge) {
    oldBadge.remove();
  }

  const badge = document.createElement("div");
  badge.id = "proofmail-verify-badge";
  
  const emailBody = document.querySelector("div[role='listitem'], div[aria-label='Message Body']");
  if (!emailBody) {
    return null;
  }

  if (elementContent) {
    badge.innerHTML = elementContent;
  }

  emailBody.prepend(badge);
  return badge;
}

async function verifyAndBadge(message, signature, pubKey) {
  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return false;
  }

  const badge = createBadgeElement();
  if (!badge) {
    return false;
  }

  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (sigBytes.length !== 64) {
      badge.innerHTML = createErrorBadge("Invalid signature length.");
      return false;
    }

    const pubKeyBytes = bs58.decode(pubKey);
    if (pubKeyBytes.length !== 32) {
      badge.innerHTML = createErrorBadge("Invalid public key length.");
      return false;
    }

    const userData = await fetchUserFromPublicKey(pubKey);
    const senderName = userData?.name || pubKey.slice(0, 8) + "...";

    const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    if (isValid) {
      if (!userData?.emailVerified) {
        badge.innerHTML = createWarningBadge(senderName);
      } else {
        badge.innerHTML = createSuccessBadge(senderName, pubKey);
      }
    } else {
      badge.innerHTML = createErrorBadge(null, senderName);
    }

    return true;
  } catch (error) {
    badge.innerHTML = createErrorBadge("Signature verification failed.");
    console.error("Signature verification failed", error);
    return false;
  }
};

window.proofmailManualCheck = async function () {
  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return false;
  }

  const emailText = emailView.innerText;
  if (!emailText || emailText.trim() === "") {
    return false;
  }

  const messageMatch = emailText.match(/([\s\S]+?)\n\n---/);
  if (!messageMatch || !messageMatch[1] || messageMatch[1].trim() === "") {
    return false;
  }

  const signatureMatch = emailText.match(/Signature: (.+)/);
  if (!signatureMatch || !signatureMatch[1] || signatureMatch[1].trim() === "") {
    return false;
  }

  const pubkeyMatch = emailText.match(/Signed by: (.+)/);
  if (!pubkeyMatch || !pubkeyMatch[1] || pubkeyMatch[1].trim() === "") {
    return false;
  }

  const signature = signatureMatch[1].trim();
  const pubKey = pubkeyMatch[1].trim();
  const message = messageMatch[1].trim();

  return verifyAndBadge(message, signature, pubKey);
};

const emailBodyMutationObserver = new MutationObserver(async () => {
  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return;
  }

  const badge = document.querySelector("#proofmail-verify-badge");
  if (badge) {
    return;
  }

  const success = await proofmailManualCheck();
  if (!success) {
    if (document.querySelector("#proofmail-verify-badge")) {
      return; // Badge already created, no need to create again
    }

    // Create an empty badge to prevent further attempts
    createBadgeElement();
  }
});

emailBodyMutationObserver.observe(document.body, {
  childList: true,
  subtree: true
});
