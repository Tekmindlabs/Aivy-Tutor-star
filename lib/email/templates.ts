export function createSignInEmail(url: string) {
    return {
      subject: 'Sign in to Aivy Tutor',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sign in to Aivy Tutor</title>
          </head>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #333;">Sign in to Aivy Tutor</h1>
            <p>Click the link below to sign in to your account:</p>
            <a 
              href="${url}" 
              style="
                background-color: #4CAF50;
                color: white;
                padding: 14px 20px;
                text-decoration: none;
                border-radius: 4px;
                display: inline-block;
                margin: 10px 0;
              "
            >
              Sign in
            </a>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this email, you can safely ignore it.
            </p>
          </body>
        </html>
      `
    };
  }