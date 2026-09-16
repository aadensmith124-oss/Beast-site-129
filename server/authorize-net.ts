import { randomUUID } from "node:crypto";

type AuthorizeNetEnvironment = "sandbox" | "production";

type AuthorizeNetConfig = {
  apiLoginId: string;
  clientKey: string;
  transactionKey: string;
  environment: AuthorizeNetEnvironment;
  apiUrl: string;
  scriptUrl: string;
};

type PaymentNonce = {
  dataDescriptor: string;
  dataValue: string;
};

type AuthorizeNetResponse = {
  messages?: {
    resultCode?: string;
    message?: Array<{ code?: string; text?: string }>;
  };
  transactionResponse?: {
    responseCode?: string;
    code?: string;
    transId?: string;
    errors?: Array<{ errorCode?: string; errorText?: string }>;
    messages?: Array<{ code?: string; description?: string }>;
  };
};

export function getAuthorizeNetConfig(): AuthorizeNetConfig | null {
  const environment = process.env.AUTHORIZE_NET_ENVIRONMENT?.trim() || "sandbox";
  if (environment !== "sandbox" && environment !== "production") return null;

  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID?.trim();
  const clientKey = process.env.AUTHORIZE_NET_CLIENT_KEY?.trim();
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY?.trim();
  if (!apiLoginId || !clientKey || !transactionKey) return null;

  return {
    apiLoginId,
    clientKey,
    transactionKey,
    environment,
    apiUrl: environment === "production"
      ? "https://api2.authorize.net/xml/v1/request.api"
      : "https://apitest.authorize.net/xml/v1/request.api",
    scriptUrl: environment === "production"
      ? "https://js.authorize.net/v1/Accept.js"
      : "https://jstest.authorize.net/v1/Accept.js",
  };
}

export function getAuthorizeNetClientConfig() {
  const config = getAuthorizeNetConfig();
  if (!config) return null;

  return {
    apiLoginId: config.apiLoginId,
    clientKey: config.clientKey,
    environment: config.environment,
    scriptUrl: config.scriptUrl,
  };
}

function getMessage(response: AuthorizeNetResponse): string {
  return response.transactionResponse?.errors?.[0]?.errorText
    ?? response.transactionResponse?.messages?.[0]?.description
    ?? response.messages?.message?.[0]?.text
    ?? "Authorize.net could not process the request";
}

async function authorizeNetRequest(
  config: AuthorizeNetConfig,
  request: Record<string, unknown>,
): Promise<AuthorizeNetResponse> {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const body = await response.json().catch(() => null) as AuthorizeNetResponse | null;
  if (!response.ok || !body) {
    throw new Error(`Authorize.net request failed (${response.status})`);
  }
  return body;
}

export async function authorizeAndVoidCard(nonce: PaymentNonce) {
  const config = getAuthorizeNetConfig();
  if (!config) {
    throw new Error("Authorize.net is not configured");
  }

  const authResponse = await authorizeNetRequest(config, {
    createTransactionRequest: {
      merchantAuthentication: {
        name: config.apiLoginId,
        transactionKey: config.transactionKey,
      },
      transactionRequest: {
        transactionType: "authOnlyTransaction",
        // A one-cent authorization is voided immediately after approval.
        amount: "0.01",
        payment: {
          opaqueData: {
            dataDescriptor: nonce.dataDescriptor,
            dataValue: nonce.dataValue,
          },
        },
        order: {
          invoiceNumber: `CHK-${randomUUID().replace(/-/g, "").slice(0, 20)}`,
          description: "Card verification",
        },
      },
    },
  });

  const transactionResponse = authResponse.transactionResponse;
  const responseCode = transactionResponse?.responseCode;
  if (responseCode !== "1") {
    return {
      status: "declined" as const,
      error: getMessage(authResponse),
    };
  }

  const transactionId = transactionResponse?.transId;
  if (!transactionId) {
    return {
      status: "declined" as const,
      error: "Authorize.net returned an approved transaction without an ID",
    };
  }

  let voided = false;
  try {
    const voidResponse = await authorizeNetRequest(config, {
      createTransactionRequest: {
        merchantAuthentication: {
          name: config.apiLoginId,
          transactionKey: config.transactionKey,
        },
        transactionRequest: {
          transactionType: "voidTransaction",
          refTransId: transactionId,
        },
      },
    });
    voided = voidResponse.transactionResponse?.responseCode === "1";
    if (!voided) {
      console.warn("[authorize-net] approved checker authorization was not voided", {
        transactionId,
        message: getMessage(voidResponse),
      });
    }
  } catch (error) {
    console.error("[authorize-net] failed to void checker authorization", {
      transactionId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return { status: "approved" as const, voided };
}