# Media worker

Python jobs are stateless and idempotent. Job state and ownership remain in Neon; media bytes live in private object storage. Workers must claim jobs atomically, validate ownership, enforce input/output limits, and record usage. Planned: FFmpeg probe/transcode, aspect-ratio adaptation, clip rendering, CPU-friendly transcription, SRT/VTT generation, and export packaging. No local GPU is assumed. Paid video generation is optional and disabled by default.
