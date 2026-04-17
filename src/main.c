#include <CoreFoundation/CoreFoundation.h>
#include <CoreFoundation/CFPlugInCOM.h>
#include <CoreServices/CoreServices.h>
#include <QuickLook/QuickLook.h>

// Forward declarations for generator callbacks
OSStatus GeneratePreviewForURL(void *thisInterface, QLPreviewRequestRef preview, CFURLRef url, CFStringRef contentTypeUTI, CFDictionaryRef options);
OSStatus GenerateThumbnailForURL(void *thisInterface, QLThumbnailRequestRef thumbnail, CFURLRef url, CFStringRef contentTypeUTI, CFDictionaryRef options, CGSize maxSize);
void CancelPreviewGeneration(void *thisInterface, QLPreviewRequestRef preview);
void CancelThumbnailGeneration(void *thisInterface, QLThumbnailRequestRef thumbnail);

// Plugin instance
typedef struct {
    QLGeneratorInterfaceStruct *iface;
    CFUUIDRef factoryID;
    UInt32 refCount;
} QLGenPluginInstance;

// --- IUnknown implementation ---

static HRESULT qlQueryInterface(void *self, REFIID iid, LPVOID *outInterface) {
    CFUUIDRef requestedID = CFUUIDCreateFromUUIDBytes(kCFAllocatorDefault, iid);
    if (CFEqual(requestedID, kQLGeneratorCallbacksInterfaceID) || CFEqual(requestedID, IUnknownUUID)) {
        ((QLGenPluginInstance *)self)->refCount++;
        *outInterface = self;
        CFRelease(requestedID);
        return S_OK;
    }
    *outInterface = NULL;
    CFRelease(requestedID);
    return E_NOINTERFACE;
}

static ULONG qlAddRef(void *self) {
    return ++((QLGenPluginInstance *)self)->refCount;
}

static ULONG qlRelease(void *self) {
    QLGenPluginInstance *inst = (QLGenPluginInstance *)self;
    if (--inst->refCount == 0) {
        CFUUIDRef fid = inst->factoryID;
        free(inst);
        if (fid) {
            CFPlugInRemoveInstanceForFactory(fid);
            CFRelease(fid);
        }
        return 0;
    }
    return inst->refCount;
}

typedef struct {
    HRESULT (*QueryInterface)(void *, REFIID, LPVOID *);
    ULONG (*AddRef)(void *);
    ULONG (*Release)(void *);
    void *conduitRef;
    SInt32 (*GenerateThumbnailForURL)(void *, QLThumbnailRequestRef, CFURLRef, CFStringRef, CFDictionaryRef, CGSize);
    void (*CancelThumbnailGeneration)(void *, QLThumbnailRequestRef);
    SInt32 (*GeneratePreviewForURL)(void *, QLPreviewRequestRef, CFURLRef, CFStringRef, CFDictionaryRef);
    void (*CancelPreviewGeneration)(void *, QLPreviewRequestRef);
} QLGenFullVtbl;

static QLGenFullVtbl gFullVtbl = {
    qlQueryInterface,
    qlAddRef,
    qlRelease,
    NULL,
    (void *)GenerateThumbnailForURL,
    (void *)CancelThumbnailGeneration,
    (void *)GeneratePreviewForURL,
    (void *)CancelPreviewGeneration
};

// --- Factory function (referenced in Info.plist) ---

void *QuickLookGeneratorPluginFactory(CFAllocatorRef allocator, CFUUIDRef typeID) {
    (void)allocator;
    if (!CFEqual(typeID, kQLGeneratorTypeID))
        return NULL;

    CFUUIDRef factoryID = CFUUIDCreateFromString(kCFAllocatorDefault,
        CFSTR("A1B2C3D4-E5F6-7890-ABCD-EF1234567890"));

    QLGenPluginInstance *inst = (QLGenPluginInstance *)malloc(sizeof(QLGenPluginInstance));
    inst->iface = (QLGeneratorInterfaceStruct *)&gFullVtbl.conduitRef;
    inst->factoryID = factoryID;
    inst->refCount = 1;
    CFPlugInAddInstanceForFactory(factoryID);

    return inst;
}

// --- Cancel stubs ---

void CancelPreviewGeneration(void *thisInterface, QLPreviewRequestRef preview) {
    (void)thisInterface; (void)preview;
}

void CancelThumbnailGeneration(void *thisInterface, QLThumbnailRequestRef thumbnail) {
    (void)thisInterface; (void)thumbnail;
}
