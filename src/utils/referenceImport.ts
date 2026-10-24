export async function sendReferenceImport(url: string, payload: unknown, key: string): Promise<{ inserted: number }> {
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let retryable = true;
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body, signal: controller.signal,
      });
      retryable = [408, 429, 502, 503, 504].includes(response.status);
      const result = await response.json().catch(() => null);
      if (response.ok && result?.success) return { inserted: Number(result.inserted) || 0 };
      retryable ||= result?.retryable === true;
      throw new Error(result?.error || 'Le serveur ne répond pas correctement. Veuillez réessayer.');
    } catch (error) {
      if (!retryable) throw error;
      if (attempt === 2) throw new Error('Connexion interrompue : la confirmation de l’import n’a pas été reçue. Vérifiez votre connexion et réessayez ; les mêmes données seront remplacées sans doublons.');
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error('Import non confirmé');
}