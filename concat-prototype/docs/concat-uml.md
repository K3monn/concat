# CONCAT UML overview

This conceptual UML class diagram shows the main application modules and the data they exchange. The app is implemented with Next.js components and API routes; these are not JavaScript classes.

```mermaid
classDiagram
  direction LR

  class Learner
  class HomePage
  class LearningSpace {
    mode: concept | practice
    phase: teach | apply | reflect
  }
  class WhiteboardCanvas
  class TldrawSync
  class ChatAPI {
    POST /api/chat
    actions: teach, board-coach, extract, scenario, test, evaluate
  }
  class MetaMuse {
    model: Muse Spark 1.3
  }
  class SessionState
  class ChatMessage {
    role: user | assistant
    content: string
  }
  class TaughtKnowledge {
    topic: string
    definedTerms: list
    statedRulesOrSteps: list
    statedReasoning: list
    explicitAssumptions: list
  }
  class Evaluation {
    hasGap: boolean
    summary: string
    suggestedReframingQuestion: string
  }
  class RecallPage
  class RecallItem {
    id: string
    topic: string
    note: string
    savedAt: date
    nextReviewAt: date
    reviewCount: number
  }
  class BrowserLocalStorage

  Learner --> HomePage : starts learning
  Learner --> LearningSpace : explains and sketches
  LearningSpace *-- WhiteboardCanvas : displays
  WhiteboardCanvas --> TldrawSync : syncs room
  LearningSpace --> ChatAPI : sends chat + board snapshot
  ChatAPI --> MetaMuse : requests tutor response
  LearningSpace --> SessionState : maintains
  SessionState *-- ChatMessage : contains
  SessionState o-- TaughtKnowledge : extracts
  SessionState o-- Evaluation : records reflection
  LearningSpace --> BrowserLocalStorage : saves recall item
  RecallPage --> BrowserLocalStorage : loads or removes items
  RecallPage ..> LearningSpace : opens saved topic for fresh recall
  BrowserLocalStorage o-- RecallItem : stores
```

The whiteboard snapshot is captured when the learner sends a message or when CONCAT reviews the board after a pause. The recall queue stores a topic and note so the learner can revisit the idea with a fresh prompt; it does not store or replay the full chat transcript.
