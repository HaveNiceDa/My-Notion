import {v} from 'convex/values'

import {mutation,query} from './_generated/server'
import {Doc,Id} from './_generated/dataModel'

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