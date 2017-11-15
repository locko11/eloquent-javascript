'use strict'

import Chapter from '../models/chapter'
import validate from '../lib/middlewares/validate'
import * as git from '../processor/git'
import * as meta from '../models/meta'
import * as Router from 'koa-router'
import { raw, required } from '../lib/ajv'

const router = new Router()

router.get('origin',
  async (ctx, next) => {
    ctx.result = await meta.get('origin')
  }
)

// Commit and push
router.patch('origin',
  validate({
    chapters: raw({
      type: 'array',
      items: { type: 'integer' },
      minItems: 1
    }),
    message: required('string')
  }),
  async (ctx, next) => {
    const { chapters: chaptersToCommit, message } = ctx.request.body
    const chapters = await Chapter.find({ _id: { $in: chaptersToCommit } })

    let count = 0
    for (const chapter of chapters) {
      if (await chapter.commit(message)) {
        await git.add(chapter.file)
        await chapter.export()
        count++
      }
    }

    if (count) {
      await git.commit(message)
      await git.push()
    }

    ctx.result = null
  }
)

// Pull
router.patch('local',
  validate({
    message: required('string')
  }),
  async (ctx, next) => {
    await git.fetch()
    await git.mergeRemote(ctx.request.body.message)
    await meta.set('origin', await git.remoteChanges())
    ctx.result = null
  }
)

export default router
