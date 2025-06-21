import bs58 from 'bs58';
import nacl from 'tweetnacl';

window.bs58 = bs58;
window.nacl = nacl;

const script = document.createElement("script");
script.src = chrome.runtime.getURL("./src/scripts/injector.js");
script.type = "module";
(document.head || document.documentElement).appendChild(script);

async function requestChallenge() {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/challenge`, {
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

async function responseChallenge(challenge, publicKey, signatures) {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/challenge`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        challenge: challenge,
        publicKey: publicKey,
        signatures: signatures
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

async function createNonce() {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/nonce`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('proofmail-session')}`
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

async function verifyNonce(nonce) {
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/nonce`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('proofmail-session')}`
      },
      body: JSON.stringify({
        nonce: nonce
      })
    });

    // if (response.status !== 200) {
    //   return null;
    // }

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

async function verifySignature(message, publicKey, signature, _, emailFrom, nonce) {
  const badge = createVerifyBadgeElement();
  if (!badge) {
    return false;
  }

  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    badge.innerHTML = createErrorBadge("Email view not found.");
    return false;
  }

  const emailBody = document.querySelector("div[role='listitem'], div[aria-label='Message Body']");
  if (!emailBody) {
    badge.innerHTML = createErrorBadge("Email body not found.");
    return false;
  }

  try {
    const userData = await fetchUserFromPublicKey(publicKey);

    if (userData && userData?.email !== emailFrom) {
      badge.innerHTML = createErrorBadge("Email from signature does not match user data.");
      return false;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const bodyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const nonceResponse = await verifyNonce(nonce);
    console.log(nonceResponse);
    if (!nonceResponse || !nonceResponse.success) {
      badge.innerHTML = createErrorBadge(nonceResponse.error || nonceResponse.message);
      console.error("Nonce verification failed", nonceResponse);
      return false;
    }

    const msgBytes = new TextEncoder().encode(
      `ProofMail-${userData?.email || emailFrom}-${bodyHash}-${nonceResponse.nonce}`
    );
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (sigBytes.length !== 64) {
      badge.innerHTML = createErrorBadge("Invalid signature length.");
      return false;
    }

    const pubKeyBytes = bs58.decode(publicKey);
    if (pubKeyBytes.length !== 32) {
      badge.innerHTML = createErrorBadge("Invalid public key length.");
      return false;
    }

    const senderName = userData?.name || publicKey.slice(0, 16) + "...";

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

window.verifyEmailSignature = async function () {
  const badge = createVerifyBadgeElement();
  if (!badge) {
    return false;
  }

  const emailView = document.querySelector('.a3s');
  if (!emailView) {
    return false;
  }

  const emailText = emailView.innerText;
  if (!emailText || emailText.trim() === "") {
    return false;
  }

  const emailTextMatch = emailText.match(/([\s\S]+?)\n\n--- PROOFMAIL SIGNATURE BEGIN ---\nSigned by: (.+)\nSignature: (.+)\nHash: (.+)\nFrom: (.+)\nNonce: (.+)\n\nThis email is signed using ProofMail. If you trust this signature, you can verify it using the ProofMail extension.\n--- PROOFMAIL SIGNATURE END ---/);
  if (!emailTextMatch) {
    console.log('test');
    return false;
  }

  const emailFromSpan = document.querySelector('span[email][name].gD');
  if (!emailFromSpan) {
    badge.innerHTML = createErrorBadge('Hovered email span not found.');
    return false;
  }

  const message = emailTextMatch[1];
  const publicKey = emailTextMatch[2];
  const signature = emailTextMatch[3];
  const bodyHash = emailTextMatch[4];
  const emailFrom = emailTextMatch[5];
  const nonce = emailTextMatch[6];

  if (emailFrom !== emailFromSpan.getAttribute('email')) {
    badge.innerHTML = createErrorBadge('Email address does not match signature.');
    return false;
  }

  return verifySignature(message, publicKey, signature, bodyHash, emailFrom, nonce);
};

const toolbarMutationObserver = new MutationObserver(async () => {
  const toolbar = document.querySelector('.Tm');
  if (!toolbar) {
    return;
  }

  // <div id=":z9" class="aoI" role="region" data-compose-id="14" jsmodel="Gt4u5c" aria-label="New Message" style="height: 429px;">
  // const composeBox = document.querySelector('div.aoI[aria-label="New Message"]');
  // if (!composeBox || !composeBox.style || !composeBox.style.height) {
  //   const existingButton = document.getElementById("proofmail-sign-btn");
  //   if (existingButton) {
  //     existingButton.remove();
  //   }
  //   return;
  // }

  const existingButton = document.getElementById("proofmail-sign-btn");
  if (existingButton) {
    return;
  }

  const button = document.createElement("button");
  button.innerText = "Sign your email with Proofmail!";
  button.id = "proofmail-sign-btn";

  button.style.cssText = `
    margin: 8px; /* Ini dari kode JS asli Anda */
    margin-left: 15px; /* Ini dari kode JS asli Anda */
    padding: 8px 16px; /* Ini dari kode JS asli Anda */
    border: 1px solid rgba(59, 130, 246, 0.6); /* Diambil dari CSS sign-mode */
    background: #3B82F6; /* Dari var(--color-blue-primary) */
    color: white;
    font-weight: 700; /* Diambil dari CSS sign-mode */
    border-radius: 12px; /* Diambil dari CSS sign-mode */
    cursor: pointer;
    font-size: 15px; /* Diambil dari CSS sign-mode (saya ambil dari button umum) */
    letter-spacing: normal; /* Umumnya tidak ada letter-spacing di CSS sign-mode, tapi bisa diatur jika mau */
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Diambil dari CSS sign-mode:active, sesuaikan untuk default */
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`;


  button.onmouseover = () => {
    button.style.background = '#306DC0';
    button.style.transform = 'translateY(-4px) scale(1.03)';
    button.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.5)';
    button.style.borderColor = 'rgba(59, 130, 246, 0.9)';
  };


  button.onmouseout = () => {
    button.style.background = '#3B82F6';
    button.style.transform = 'none';
    button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    button.style.borderColor = 'rgba(59, 130, 246, 0.6)';
  };


  button.onclick = async () => {
    if (localStorage.getItem('proofmail-session') === null) {
      const response = await requestChallenge();
      if (!response || !response.challenge) {
        console.error("Failed to fetch challenge");
        return;
      }

      window.postMessage({
        type: 'PROOFMAILSIGNCHALLENGE',
        challenge: response.challenge
      }, '*');
      return;
    }

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

    const nonce = await createNonce();
    if (!nonce) {
      badge.innerHTML = createErrorBadge('Failed to create nonce.');
      return;
    }

    window.postMessage({
      type: "PROOFMAILSIGN",
      message: {
        email: metaTag.content,
        bodyHash: bodyHash,
        nonce: nonce.nonce
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
    const nonce = event.data.nonce;

    if (!pubKey || !signature || !bodyHash || !email || !nonce) {
      badge.innerHTML = createErrorBadge('Invalid signature data received.');
      return;
    }

    emailBodyElement.innerText += `\n\n--- PROOFMAIL SIGNATURE BEGIN ---\nSigned by: ${pubKey}\nSignature: ${signature}\nHash: ${bodyHash}\nFrom: ${email}\nNonce: ${nonce}\n\nThis email is signed using ProofMail. If you trust this signature, you can verify it using the ProofMail extension.\n--- PROOFMAIL SIGNATURE END ---\n`;

    badge.innerHTML = createSuccessBadge('Email signed successfully. You can now send it.');
  } else if (event.data.type == 'PROOFMAILSIGNFAILED') {
    const badge = createSignBadgeElement();
    if (!badge) {
      alert('Failed to create sign badge element');
      return;
    }

    badge.innerHTML = createErrorBadge(event.data.message);
  } else if (event.data.type === 'PROOFMAILSIGNEDCHALLENGE') {
    const badge = createSignBadgeElement();
    if (!badge) {
      alert('Failed to create sign badge element');
      return;
    }

    const response = await responseChallenge(event.data.challenge, event.data.publicKey, event.data.signatures);
    if (!response || !response.success) {
      badge.innerHTML = createErrorBadge(response?.message || 'Failed to verify challenge. Please try again.');
      return;
    }

    localStorage.setItem('proofmail-session', response.session);
    badge.innerHTML = createSuccessBadge('Challenge signed successfully. You can now sign your emails.');
  } else if (event.data.type === 'PROOFMAILSIGNCHALLENGEFAILED') {
    const badge = createSignBadgeElement();
    if (!badge) {
      alert('Failed to create sign badge element');
      return;
    }

    badge.innerHTML = createErrorBadge(event.data.message || 'Failed to sign challenge. Please try again.');
  }
});
