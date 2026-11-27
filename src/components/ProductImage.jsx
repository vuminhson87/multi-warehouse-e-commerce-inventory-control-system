import { useState } from 'react'
import { resolveMediaUrl } from '../utils/format'

export default function ProductImage({ imageUrl, name, loading = 'lazy' }) {
    const [failedUrl, setFailedUrl] = useState(null)
    const src = resolveMediaUrl(imageUrl)

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

