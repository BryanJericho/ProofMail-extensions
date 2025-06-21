import bs58 from 'bs58';
import nacl from 'tweetnacl';

window.bs58 = bs58;
window.nacl = nacl;

const script = document.createElement("script");
script.src = chrome.runtime.getURL("./src/scripts/injector.js");
script.type = "module";
(document.head || document.documentElement).appendChild(script);

async function createNonceByPublicKey(pubKey, nonce) {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/create-nonce/${pubKey}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nonce: nonce
      })
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

async function verifyNonceByPublicKey(pubKey, nonce) {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/verify-nonce/${pubKey}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nonce: nonce
      })
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

async function fetchUserFromPublicKey(pubKey) {
  try {
    const response = await fetch(`https://proofmail-fe-development.vercel.app/api/by-pubkey/${pubKey}`, {
      method: 'GET',
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

const createSuccessBadge = (message) => {
  return `<div style="
    ${BADGE_BASE_STYLE}
    background: linear-gradient(90deg, #22c55e 0%, #15803d 100%); /* Gradien hijau */
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); /* Glow hijau */
    border: 1px solid rgba(34, 197, 94, 0.6);
    ">
    ✅ ProofMail: ${message}<br>
  </div>`;
}

const createWarningBadge = (message) => {
  return `<div style="
    ${BADGE_BASE_STYLE}
    background: linear-gradient(90deg, #fbbf24 0%, #b45309 100%); /* Gradien kuning */
    box-shadow: 0 4px 15px rgba(250, 186, 36, 0.4); /* Glow kuning */
    border: 1px solid rgba(250, 186, 36, 0.6);
    ">
    ⚠️ ProofMail: ${message}<br>
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

const createSignBadgeElement = () => {
  const oldBadge = document.querySelector("#proofmail-sign-badge");
  if (oldBadge) {
    oldBadge.remove();
  }

  const badge = document.createElement("div");
  badge.id = "proofmail-sign-badge";

  const toolbar = document.querySelector('.Tm');
  if (!toolbar) {
    return;
  }

  toolbar.prepend(badge);
  return badge;
}

const createVerifyBadgeElement = () => {
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

  emailBody.prepend(badge);
  return badge;
}

async function verifyAndBadge(emailFrom, message, signature, pubKey, hash) {
  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return false;
  }

  const emailBody = document.querySelector("div[role='listitem'], div[aria-label='Message Body']");
  if (!emailBody) {
    return false;
  }

  const badge = createVerifyBadgeElement();
  if (!badge) {
    return false;
  }

  try {
    const userData = await fetchUserFromPublicKey(pubKey);
    // const verification = await verifyNonceByPublicKey(pubKey, nonce);

    if (userData && userData?.email !== emailFrom) {
      badge.innerHTML = createErrorBadge("Email from signature does not match hovered email.");
      return false;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const bodyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(bodyHash)

    const msgBytes = new TextEncoder().encode(
      `ProofMail-${userData?.email || emailFrom}-${bodyHash}`
    );
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

    const senderName = userData?.name || pubKey.slice(0, 16) + "...";

    const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    if (isValid) {
      if (!userData) {
        badge.innerHTML = createWarningBadge(`User ${senderName} is not registered.`);
      } else {
        badge.innerHTML = createSuccessBadge(`Email verified successfully from <strong>${senderName}</strong>.`);
      }
    } else {
      badge.innerHTML = createErrorBadge(`Invalid signature from <strong>${senderName}</strong>.`);
    }

    return true;
  } catch (error) {
    badge.innerHTML = createErrorBadge("Signature verification failed.");
    console.error("Signature verification failed", error);
    return false;
  }
};

const isMatchEmpty = (str) => !str || str.trim() === "";

const deserializeEmailText = (emailText) => {
  const messageMatch = emailText.match(/([\s\S]+?)\n\n---/);
  if (!messageMatch || isMatchEmpty(messageMatch[1])) {
    return null;
  }

  const signatureMatch = emailText.match(/Signature: (.+)/);
  if (!signatureMatch || isMatchEmpty(signatureMatch[1])) {
    return null;
  }

  const pubkeyMatch = emailText.match(/Signed by: (.+)/);
  if (!pubkeyMatch || isMatchEmpty(pubkeyMatch[1])) {
    return null;
  }

  const emailMatch = emailText.match(/From: (.+)/);
  if (!emailMatch || isMatchEmpty(emailMatch[1])) {
    return null;
  }

  const emailFrom = emailMatch[1].trim();
  if (emailFrom !== emailText.match(/From: (.+)/)[1].trim()) {
    return null;
  }

  const hashMatch = emailText.match(/Hash: (.+)/);
  if (!hashMatch || isMatchEmpty(hashMatch[1])) {
    return null;
  }

  const signature = signatureMatch[1].trim();
  const pubKey = pubkeyMatch[1].trim();
  const message = messageMatch[1].trim();
  const hash = hashMatch[1].trim();

  return { emailFrom, message, signature, pubKey, hash };
};

window.verifyEmailSignature = async function () {
  const badge = createVerifyBadgeElement();
  if (!badge) {
    return false;
  }

  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    badge.innerHTML = createErrorBadge("Email view not found.");
    return false;
  }

  const emailText = emailView.innerText;
  if (!emailText || emailText.trim() === "") {
    badge.innerHTML = createErrorBadge("Email text is empty.");
    return false;
  }

  // <span translate="no" class="yP" email="zentay36@gmail.com" name="ZTzTopia" data-hovercard-id="zentay36@gmail.com">ZTzTopia</span>
  const hoveredSpan = document.querySelector("span[email][name].gD");
  if (!hoveredSpan) {
    badge.innerHTML = createErrorBadge("Hovered email span not found.");
    return false;
  }

  const email = hoveredSpan.getAttribute("email");
  if (!email || email.trim() === "") {
    badge.innerHTML = createErrorBadge("Email address not found.");
    return false;
  }

  const deserialized = deserializeEmailText(emailText);
  if (!deserialized) {
    badge.innerHTML = createErrorBadge("Failed to deserialize email text.");
    return false;
  }

  console.log(email)

  const { emailFrom, message, signature, pubKey, hash } = deserialized;
  if (emailFrom !== email) {
    badge.innerHTML = createErrorBadge("Email address does not match hovered email.");
    return false;
  }

  return verifyAndBadge(emailFrom, message, signature, pubKey, hash);
};

const toolbarMutationObserver = new MutationObserver(async () => {
  const toolbar = document.querySelector('.Tm');
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

  button.onclick = async () => {
    const badge = createSignBadgeElement();
    if (!badge) {
      return;
    }

    const metaTag = document.querySelector('meta[name="og-profile-acct"]');
    if (!metaTag) {
      badge.innerHTML = createErrorBadge("Meta tag for email not found.");
      return;
    }

    const emailBody = document.querySelector('.Am.Al.editable');
    if (!emailBody) {
      badge.innerHTML = createErrorBadge("Please compose an email first.");
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(emailBody.innerText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const bodyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    window.postMessage({
      type: "PROOFMAILSIGN",
      message: {
        email: metaTag.content,
        bodyHash: bodyHash
      }
    }, "*");
  };

  toolbar.prepend(button);
});

toolbarMutationObserver.observe(document.body, {
  childList: true,
  subtree: true
});

const emailBodyMutationObserver = new MutationObserver(async () => {
  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return;
  }

  const badge = document.querySelector("#proofmail-verify-badge");
  if (badge) {
    return;
  }

  const success = await verifyEmailSignature();
  if (!success) {
    if (document.querySelector("#proofmail-verify-badge")) {
      return; // Badge already created, no need to create again
    }

    // Create an empty badge to prevent further attempts
    createVerifyBadgeElement();
  }
});

emailBodyMutationObserver.observe(document.body, {
  childList: true,
  subtree: true
});

window.addEventListener('message', async (event) => {
  if (event.data.type === 'PROOFMAILSIGNED') {
    const badge = createSignBadgeElement();
    if (!badge) {
      alert('Failed to create sign badge element');
      return;
    }

    const emailBodyElement = document.querySelector('.Am.Al.editable');
    if (!emailBodyElement) {
      badge.innerHTML = createErrorBadge('Email body not found. Please compose an email first.');
      return;
    }

    const pubKey = event.data.publicKey;
    const signature = event.data.signature;
    const bodyHash = event.data.bodyHash;
    const email = event.data.email;

    if (!signature || !pubKey || !email || !bodyHash) {
      badge.innerHTML = createErrorBadge('Invalid signature data received.');
      return;
    }

    /* const response = await createNonceByPublicKey(pubKey, nonce);
    if (!response) {
      badge.innerHTML = createErrorBadge('Failed to create nonce for public key.');
      return;
    } */

    const signatureBlock = `\n\n---\nSigned by: ${pubKey}\nSignature: ${signature}\nHash: ${bodyHash}\nFrom: ${email}\n\nThis email is signed using ProofMail. If you trust this signature, you can verify it using the ProofMail extension.\n---`;
    emailBodyElement.innerText += signatureBlock;

    badge.innerHTML = createSuccessBadge('Email signed successfully. You can now send it.');
  } else if (event.data.type == 'PROOFMAILSIGNFAILED') {
    const badge = createSignBadgeElement();
    if (!badge) {
      alert('Failed to create sign badge element');
      return;
    }

    badge.innerHTML = createErrorBadge(event.data.message);
  }
});
