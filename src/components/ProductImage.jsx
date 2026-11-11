import { useState } from 'react'

export default function ProductImage({ imageUrl, name, loading = 'lazy' }) {
    const [failedUrl, setFailedUrl] = useState(null)
    const src = typeof imageUrl === 'string' ? imageUrl.trim() : ''

    if (!src || src === failedUrl) {
        return <span aria-hidden="true">💻</span>
    }

    return (
        <img
            src={src}
            alt={name}
            loading={loading}
            onError={() => setFailedUrl(src)}
        />
    )
}

