/**
 * 文档相关操作方法
 */
import {v} from 'convex/values'

import {mutation,query} from './_generated/server'
import {Doc,Id} from './_generated/dataModel'

/**
 * 归档文档（递归归档子文档）
 * @param id 文档ID
 * @returns 归档后的文档
 */
export const archive = mutation({
  args:{id:v.id("documents")},
  handler:async (context,args) => {
   const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject
    
    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const recursiveArchive = async (documentId:Id<'documents'>) => {
      const children = await context.db
      .query('documents')
      .withIndex("by_user_parent",q => (
        q.eq("userId",userId).eq('parentDocument',documentId)
      ))
      .collect()
    
      for (const child of children) {
        await context.db.patch(child._id,{
          isArchived:true
        })
        await recursiveArchive(child._id)
      }
    }

    const document = await context.db.patch(args.id,{
      isArchived:true
    })

    recursiveArchive(args.id)

    return document
  }
})

/**
 * 获取侧边栏文档列表
 * @param parentDocument 可选，父文档ID，用于获取子文档
 * @returns 文档列表，按创建时间倒序排列
 */
export const getSidebar = query({
  args:{
    parentDocument:v.optional(v.id("documents"))
  },
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const documents = await context.db
    .query("documents")
    .withIndex("by_user_parent",(q) => q.eq('userId',userId)
    .eq('parentDocument',args.parentDocument))
    .filter(q => q.eq(q.field("isArchived"),false))
    .order('desc')
    .collect()

    return documents
  }
})

/**
 * 获取收藏的文档列表
 * @returns 收藏的文档列表，按创建时间倒序排列
 */
export const getStarred = query({
  args:{},
  handler:async (context) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const documents = await context.db
    .query("documents")
    .withIndex("by_user", (q) => q.eq('userId', userId))
    .filter(q => q.and(
      q.eq(q.field("isArchived"), false),
      q.eq(q.field("isStarred"), true)
    ))
    .order('desc')
    .collect()

    return documents
  }
})

/**
 * 创建新文档
 * @param title 文档标题
 * @param parentDocument 可选，父文档ID
 * @returns 创建的文档
 */
export const create = mutation({
  args:{
    title:v.string(),
    parentDocument:v.optional(v.id('documents'))
  },
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const document = await context.db.insert('documents',{
      title:args.title,
      parentDocument:args.parentDocument,
      userId,
      isArchived:false,
      isPublished:false,
      isStarred:false,
      lastEditedTime:Date.now()
    })

    return document
  }
})

/**
 * 获取回收站文档列表
 * @returns 已归档的文档列表，按创建时间倒序排列
 */
export const getTrash = query({
  handler:async (context) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const documents = await context.db.query('documents')
    .withIndex('by_user',q => q.eq('userId',userId))
    .filter(q => q.eq(q.field('isArchived'),true))
    .order('desc')
    .collect()

    return documents
  }
})

/**
 * 恢复文档（递归恢复子文档）
 * @param id 文档ID
 * @returns 恢复后的文档
 */
export const restore = mutation({
  args:{id:v.id('documents')},
  handler: async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const recursiveRestore = async (documentId:Id<'documents'>) => {
      const children = await context.db.query('documents')
      .withIndex('by_user_parent',q => (
        q.eq('userId',userId).eq('parentDocument',documentId)
      ))
      .collect()

      for (const child of children) {
        await context.db.patch(child._id,{
          isArchived:false
        })

        await recursiveRestore(child._id)
      }
    }

    const options:Partial<Doc<'documents'>> = {
      isArchived:false
    }

    if (existingDocument.parentDocument) {
      const parent = await context.db.get(existingDocument.parentDocument)
      if (parent?.isArchived) {
        options.parentDocument = undefined
      }
    }

    const document = await context.db.patch(args.id,options)

    recursiveRestore(args.id)

    return document
  }
})


/**
 * 删除文档
 * @param id 文档ID
 * @returns 删除的文档
 */
export const remove = mutation({
  args:{id:v.id('documents')},
  handler:async (context,args) => {

    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const document = await context.db.delete(args.id)

    return document
  }
})

/**
 * 获取搜索文档列表（未归档的文档）
 * @returns 未归档的文档列表，按创建时间倒序排列
 */
export const getSearch = query({
  handler:async (context) => {
   
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Not authenticated')
    }

    const userId = identity.subject
    
    const documents = await context.db.query('documents')
    .withIndex('by_user',q => q.eq('userId',userId))
    .filter(q => q.eq(q.field('isArchived'),false))
    .order('desc')
    .collect()

    return documents
  }
})

/**
 * 根据ID获取文档
 * @param documentId 文档ID
 * @returns 文档信息
 */
export const getById = query({
  args:{documentId:v.id('documents')},
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    const document = await context.db.get(args.documentId)

    if (!document) {
      throw new Error("Not found")
    }

    if (document.isPublished && !document.isArchived) {
      return document
    }

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    if (document.userId !== userId)  {
      throw new Error("Unauthorized")
    }
    
    return document
  }
})


/**
 * 更新文档信息
 * @param id 文档ID
 * @param title 可选，文档标题
 * @param content 可选，文档内容
 * @param coverImage 可选，封面图片URL
 * @param icon 可选，文档图标
 * @param isPublished 可选，是否发布
 * @param isStarred 可选，是否收藏
 * @returns 更新后的文档
 */
export const update = mutation({
  args:{
    id:v.id('documents'),
    title:v.optional(v.string()),
    content:v.optional(v.string()),
    coverImage:v.optional(v.string()),
    icon:v.optional(v.string()),
    isPublished:v.optional(v.boolean()),
    isStarred:v.optional(v.boolean())
  },
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Unauthenticated")
    }

    const userId = identity.subject

    const {id,...rest} = args

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error("Not found")
    }

    if (existingDocument.userId !== userId) {
      throw new Error('Unauthorized')
    }

    const document = await context.db.patch(args.id,{
      ...rest,
      lastEditedTime: Date.now()
    })

    return document
  }
})


/**
 * 移除文档图标
 * @param id 文档ID
 * @returns 更新后的文档
 */
export const removeIcon = mutation({
  args:{id:v.id('documents')},
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Unauthenticated")
    }

    const userId = identity.subject

     const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const document = await context.db.patch(args.id,{
      icon:undefined
    })

    return document
  } 
})

/**
 * 移除文档封面图片
 * @param id 文档ID
 * @returns 更新后的文档
 */
export const removeCoverImage = mutation({
  args:{id:v.id('documents')},
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Unauthenticated")
    }

    const userId = identity.subject

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const document = await context.db.patch(args.id,{
      coverImage:undefined
    })

    return document
  }
})

/**
 * 移动文档（更改父文档）
 * @param id 文档ID
 * @param parentDocument 可选，新的父文档ID
 * @returns 更新后的文档
 */
export const move = mutation({
  args:{
    id:v.id('documents'),
    parentDocument:v.optional(v.id('documents'))
  },
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Unauthenticated")
    }

    const userId = identity.subject

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error('Unauthorized')
    }

    // 防止循环移动（将文档移动到自己的子文档中）
    if (args.parentDocument) {
      let currentParent: Id<'documents'> | undefined = args.parentDocument
      while (currentParent) {
        const parentDoc: Doc<'documents'> | null = await context.db.get(currentParent)
        if (!parentDoc) break
        if (parentDoc._id === args.id) {
          throw new Error('Cannot move document into its own subtree')
        }
        currentParent = parentDoc.parentDocument
      }
    }

    const document = await context.db.patch(args.id,{
      parentDocument:args.parentDocument
    })

    return document
  }
})

/**
 * 获取文档路径（从根文档到当前文档的路径）
 * @param documentId 文档ID
 * @returns 文档路径数组，按从根到当前的顺序排列
 */
export const getDocumentPath = query({
  args:{documentId:v.id('documents')},
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const path:Doc<'documents'>[] = []
    let currentDocument:Doc<'documents'> | null | undefined = await context.db.get(args.documentId)

    if (!currentDocument) {
      throw new Error("Not found")
    }

    if (currentDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    // 从当前文档向上遍历，构建路径
    while (currentDocument) {
      path.unshift(currentDocument)
      if (currentDocument.parentDocument) {
        currentDocument = await context.db.get(currentDocument.parentDocument)
      } else {
        break
      }
    }

    return path
  }
})

/**
 * 切换文档收藏状态
 * @param id 文档ID
 * @param isStarred 是否收藏
 * @returns 更新后的文档
 */
export const toggleStar = mutation({
  args:{id:v.id('documents'),isStarred:v.boolean()},
  handler:async (context,args) => {
    const identity = await context.auth.getUserIdentity()

    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const existingDocument = await context.db.get(args.id)

    if (!existingDocument) {
      throw new Error('Not found')
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized")
    }

    const document = await context.db.patch(args.id,{
      isStarred: args.isStarred,
      lastEditedTime: Date.now()
    })

    return document
  }
})