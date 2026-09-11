import fs from 'fs'
import path from 'path'
import React from 'react'

export const metadata = {
  title: 'Public Images — Ginie',
  description: 'Preview of all images stored in the public folder.',
}

function isImage(filename: string) {
  return /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(filename)
}

export default function ImagesPage() {
  const publicDir = path.join(process.cwd(), 'public')
  let files: string[] = []
  try {
    files = fs.readdirSync(publicDir).filter(isImage)
  } catch (e) {
    files = []
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Public directory — Image preview</h1>
      <p className="text-sm text-muted-foreground mb-6">Listing {files.length} image(s) from the <strong>public</strong> folder.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {files.map((file) => (
          <div key={file} className="border rounded-md p-3 bg-background/40">
            <a href={`/${file}`} target="_blank" rel="noreferrer" className="block">
              <img src={`/${file}`} alt={file} className="w-full h-40 object-contain mb-2" />
            </a>
            <div className="text-sm break-words">{file}</div>
            <div className="text-xs text-muted-foreground">/{file}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
