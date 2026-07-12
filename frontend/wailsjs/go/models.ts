export namespace index {
	
	export class ObjectRow {
	    path: string;
	    type: string;
	    title: string;
	    properties: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ObjectRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.type = source["type"];
	        this.title = source["title"];
	        this.properties = source["properties"];
	    }
	}
	export class SearchResult {
	    path: string;
	    title: string;
	    snippet: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.title = source["title"];
	        this.snippet = source["snippet"];
	    }
	}

}

export namespace schema {
	
	export class KindMeta {
	    kind: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new KindMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.label = source["label"];
	    }
	}
	export class View {
	    name: string;
	    type: string;
	    groupBy?: string;
	    columns?: string[];
	
	    static createFrom(source: any = {}) {
	        return new View(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.groupBy = source["groupBy"];
	        this.columns = source["columns"];
	    }
	}
	export class Property {
	    key: string;
	    label: string;
	    kind: string;
	    required?: boolean;
	    options?: string[];
	    default?: any;
	    relationType?: string;
	    multiple?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Property(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.kind = source["kind"];
	        this.required = source["required"];
	        this.options = source["options"];
	        this.default = source["default"];
	        this.relationType = source["relationType"];
	        this.multiple = source["multiple"];
	    }
	}
	export class Schema {
	    id: string;
	    name: string;
	    icon?: string;
	    color?: string;
	    extends?: string;
	    properties?: Property[];
	    views?: View[];
	    template?: string;
	
	    static createFrom(source: any = {}) {
	        return new Schema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.color = source["color"];
	        this.extends = source["extends"];
	        this.properties = this.convertValues(source["properties"], Property);
	        this.views = this.convertValues(source["views"], View);
	        this.template = source["template"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LoadedSchema {
	    id: string;
	    schema: Schema;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LoadedSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.schema = this.convertValues(source["schema"], Schema);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

export namespace vault {
	
	export class Node {
	    name: string;
	    path: string;
	    type: string;
	    children?: Node[];
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.type = source["type"];
	        this.children = this.convertValues(source["children"], Node);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Note {
	    path: string;
	    rawContent: string;
	    body: string;
	    frontmatterRaw: string;
	    frontmatter: Record<string, any>;
	    frontmatterError?: string;
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.rawContent = source["rawContent"];
	        this.body = source["body"];
	        this.frontmatterRaw = source["frontmatterRaw"];
	        this.frontmatter = source["frontmatter"];
	        this.frontmatterError = source["frontmatterError"];
	    }
	}

}

