// Export all trigger tasks for easy importing in server actions
export { onboardingTask } from "./onboarding";
export { getRecentPlaysTask } from "./get-recent-plays";

export async function refreshAccessToken(spotify_refresh_token: string) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`
          },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: spotify_refresh_token
        })
    });
    
    if (!response.ok) {
        const errorData = await response.text();
        return { data: null, error: `HTTP ${response.status}: ${errorData}` };
    }
    
    const data = await response.json();
    
    return { data, error: null };
}